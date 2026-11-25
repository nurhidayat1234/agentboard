// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title AgentBoard — Agent ID-gated micro-task escrow on BNB Chain
/// @notice Only Agent ID holders can create or claim tasks.
/// Agent ID (SPACE ID, ERC-721, non-transferable, BNB Chain):
/// 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
/// Holder check: balanceOf(address) > 0.
/// @dev No owner, no mint, no tax, no pause, no admin withdraw.
/// Funds only flow creator -> claimer on approval, or back to the
/// creator on cancel before a claim. No token is issued.
interface IAgentID {
    function balanceOf(address account) external view returns (uint256);
}

contract TaskBoard is ReentrancyGuard {
    // Agent ID registry, set at deploy time so the contract is testable
    // with a mock locally. On BNB Chain deploy with:
    // 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
    IAgentID public immutable AGENT_ID;

    constructor(address agentId) {
        require(agentId != address(0), "AgentBoard: agentId required");
        AGENT_ID = IAgentID(agentId);
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
    }

    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;

    event TaskCreated(uint256 indexed id, address indexed creator, string title, uint256 reward);
    event TaskClaimed(uint256 indexed id, address indexed claimer);
    event ProofSubmitted(uint256 indexed id, address indexed claimer, string proof);
    event TaskApproved(uint256 indexed id, address indexed claimer, uint256 reward);
    event TaskCancelled(uint256 indexed id, address indexed creator);

    modifier onlyAgentIDHolder(address account) {
        require(AGENT_ID.balanceOf(account) > 0, "AgentBoard: caller holds no Agent ID");
        _;
    }

    /// @notice Create a task and escrow its reward in BNB.
    function createTask(string calldata title) external payable nonReentrant onlyAgentIDHolder(msg.sender) {
        require(msg.value > 0, "AgentBoard: reward must be > 0");
        require(bytes(title).length > 0, "AgentBoard: title required");
        taskCount += 1;
        tasks[taskCount] = Task({
            id: taskCount,
            creator: msg.sender,
            claimer: address(0),
            title: title,
            reward: msg.value,
            status: Status.Open,
            proof: ""
        });
        emit TaskCreated(taskCount, msg.sender, title, msg.value);
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

    /// @notice Creator approves the proof and releases the escrowed reward to the claimer.
    function approveTask(uint256 id) external nonReentrant {
        Task storage task = tasks[id];
        require(task.id != 0, "AgentBoard: task does not exist");
        require(task.status == Status.Submitted, "AgentBoard: no proof submitted");
        require(msg.sender == task.creator, "AgentBoard: only creator can approve");
        task.status = Status.Completed;
        uint256 reward = task.reward;
        task.reward = 0;
        (bool ok, ) = payable(task.claimer).call{value: reward}("");
        require(ok, "AgentBoard: reward transfer failed");
        emit TaskApproved(id, task.claimer, reward);
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
