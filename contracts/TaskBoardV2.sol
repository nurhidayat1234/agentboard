// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title AgentBoard V2 — Agent ID-gated micro-task escrow with points
/// @notice Same flow as v1, plus a points system:
/// - The creator sets the task's points (1-100) when creating it.
/// - On approve, the claimer earns the task's points AND the reward moves
///   into their pending balance (it is NOT paid out immediately).
/// - `claimBNB()` withdraws the whole pending balance, but only once the
///   caller has at least 100 points. Points are a lifetime score: claiming
///   does not spend them (see PLAN.md "Point System (v3)" for the design
///   and the alternatives).
/// Agent ID (SPACE ID, ERC-721, non-transferable, BNB Chain):
/// 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
/// Holder check: balanceOf(address) > 0.
/// @dev No owner, no mint, no tax, no pause, no admin withdraw.
/// Funds only flow creator -> claimer pending -> claimer on claimBNB,
/// or back to the creator on cancel before a claim. No token is issued.
interface IAgentID {
    function balanceOf(address account) external view returns (uint256);
}

contract TaskBoardV2 is ReentrancyGuard {
    // Agent ID registry, set at deploy time so the contract is testable
    // with a mock locally. On BNB Chain deploy with:
    // 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
    IAgentID public immutable AGENT_ID;

    /// @notice Points needed to unlock claiming the pending BNB balance.
    uint256 public constant POINTS_TO_CLAIM = 100;
    /// @notice Maximum points a single task can carry.
    uint256 public constant MAX_POINTS_PER_TASK = 100;

    /// @notice When false, the Agent ID gate is OFF: anyone can
    /// create/claim tasks. Testnet only — mainnet MUST deploy with true
    /// (the Agent ID gate is the product's core for the hackathon).
    bool public immutable GATE_ENABLED;

    constructor(address agentId, bool gateEnabled) {
        require(!gateEnabled || agentId != address(0), "AgentBoard: agentId required when gate is on");
        AGENT_ID = IAgentID(agentId);
        GATE_ENABLED = gateEnabled;
    }

    enum Status {
        Open,
        Claimed,
        Submitted,
        Completed,
        Cancelled
    }

    struct Task {
        uint256 id;
        address creator;
        address claimer;
        string title;
        uint256 reward;
        Status status;
        string proof;
        uint256 points;
    }

    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;

    /// @notice Lifetime points earned by completing tasks.
    mapping(address => uint256) public points;
    /// @notice BNB earned but not yet claimed (claimable at 100 points).
    mapping(address => uint256) public pendingBNB;
    /// @notice Number of tasks an address completed as claimer.
    mapping(address => uint256) public tasksCompleted;

    event TaskCreated(uint256 indexed id, address indexed creator, string title, uint256 reward, uint256 points);
    event TaskClaimed(uint256 indexed id, address indexed claimer);
    event ProofSubmitted(uint256 indexed id, address indexed claimer, string proof);
    event TaskApproved(uint256 indexed id, address indexed claimer, uint256 reward, uint256 points);
    event TaskCancelled(uint256 indexed id, address indexed creator);
    event PointsEarned(address indexed claimer, uint256 indexed taskId, uint256 points);
    event BNBClaimed(address indexed claimer, uint256 amount);

    modifier onlyAgentIDHolder(address account) {
        if (GATE_ENABLED) {
            require(AGENT_ID.balanceOf(account) > 0, "AgentBoard: caller holds no Agent ID");
        }
        _;
    }

    /// @notice Create a task, escrow its reward in BNB, and set its points.
    function createTask(string calldata title, uint256 taskPoints) external payable nonReentrant onlyAgentIDHolder(msg.sender) {
        require(msg.value > 0, "AgentBoard: reward must be > 0");
        require(bytes(title).length > 0, "AgentBoard: title required");
        require(taskPoints >= 1 && taskPoints <= MAX_POINTS_PER_TASK, "AgentBoard: points must be 1-100");
        taskCount += 1;
        tasks[taskCount] = Task({
            id: taskCount,
            creator: msg.sender,
            claimer: address(0),
            title: title,
            reward: msg.value,
            status: Status.Open,
            proof: "",
            points: taskPoints
        });
        emit TaskCreated(taskCount, msg.sender, title, msg.value, taskPoints);
    }

    /// @notice Claim an open task. Claimer must hold an Agent ID and differ from the creator.
    function claimTask(uint256 id) external nonReentrant onlyAgentIDHolder(msg.sender) {
        Task storage task = tasks[id];
        require(task.id != 0, "AgentBoard: task does not exist");
        require(task.status == Status.Open, "AgentBoard: task not open");
        require(msg.sender != task.creator, "AgentBoard: creator cannot claim own task");
        task.claimer = msg.sender;
        task.status = Status.Claimed;
        emit TaskClaimed(id, msg.sender);
    }

    /// @notice Claimer submits proof of completion (text or link/hash).
    function submitProof(uint256 id, string calldata proof) external {
        Task storage task = tasks[id];
        require(task.id != 0, "AgentBoard: task does not exist");
        require(task.status == Status.Claimed, "AgentBoard: task not claimed");
        require(msg.sender == task.claimer, "AgentBoard: only claimer can submit proof");
        require(bytes(proof).length > 0, "AgentBoard: proof required");
        task.proof = proof;
        task.status = Status.Submitted;
        emit ProofSubmitted(id, msg.sender, proof);
    }

    /// @notice Creator approves the proof: claimer earns points and the
    /// reward moves into their pending balance (not paid out yet).
    function approveTask(uint256 id) external nonReentrant {
        Task storage task = tasks[id];
        require(task.id != 0, "AgentBoard: task does not exist");
        require(task.status == Status.Submitted, "AgentBoard: no proof submitted");
        require(msg.sender == task.creator, "AgentBoard: only creator can approve");
        task.status = Status.Completed;
        uint256 reward = task.reward;
        uint256 earned = task.points;
        task.reward = 0;
        points[task.claimer] += earned;
        pendingBNB[task.claimer] += reward;
        tasksCompleted[task.claimer] += 1;
        emit PointsEarned(task.claimer, id, earned);
        emit TaskApproved(id, task.claimer, reward, earned);
    }

    /// @notice Withdraw the whole pending BNB balance. Requires 100 points.
    /// Points are NOT spent by claiming (lifetime score, one-time gate).
    function claimBNB() external nonReentrant {
        require(points[msg.sender] >= POINTS_TO_CLAIM, "AgentBoard: need 100 points to claim");
        uint256 amount = pendingBNB[msg.sender];
        require(amount > 0, "AgentBoard: nothing to claim");
        pendingBNB[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "AgentBoard: claim transfer failed");
        emit BNBClaimed(msg.sender, amount);
    }

    /// @notice Creator cancels an unclaimed task and gets the escrow refunded.
    function cancelTask(uint256 id) external nonReentrant {
        Task storage task = tasks[id];
        require(task.id != 0, "AgentBoard: task does not exist");
        require(task.status == Status.Open, "AgentBoard: only open tasks can be cancelled");
        require(msg.sender == task.creator, "AgentBoard: only creator can cancel");
        task.status = Status.Cancelled;
        uint256 reward = task.reward;
        task.reward = 0;
        (bool ok, ) = payable(task.creator).call{value: reward}("");
        require(ok, "AgentBoard: refund failed");
        emit TaskCancelled(id, msg.sender);
    }
}
