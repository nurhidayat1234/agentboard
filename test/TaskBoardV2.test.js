const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TaskBoardV2 — points system", function () {
  async function deploy(gateEnabled = true) {
    const [creator, claimer, stranger] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentID");
    const mock = await Mock.deploy();
    const Board = await ethers.getContractFactory("TaskBoardV2");
    const board = await Board.deploy(await mock.getAddress(), gateEnabled);
    await mock.setBalance(creator.address, 1);
    await mock.setBalance(claimer.address, 1);
    // stranger holds no Agent ID on purpose
    return { board, mock, creator, claimer, stranger };
  }

  async function finishTask(board, creator, claimer, reward, taskPoints) {
    const id = Number(await board.taskCount()) + 1;
    await board.connect(creator).createTask("T" + id, taskPoints, { value: ethers.parseEther(reward) });
    await board.connect(claimer).claimTask(id);
    await board.connect(claimer).submitProof(id, "https://example.com/proof");
    await board.connect(creator).approveTask(id);
    return id;
  }

  it("creates a task with points (default 10) and rejects out-of-range points", async function () {
    const { board, creator } = await deploy();
    await expect(board.connect(creator).createTask("Review README", 10, { value: ethers.parseEther("0.01") }))
      .to.emit(board, "TaskCreated");
    const task = await board.tasks(1);
    expect(task.points).to.equal(10);
    expect(task.status).to.equal(0); // Open
    await expect(board.connect(creator).createTask("Zero", 0, { value: ethers.parseEther("0.01") }))
      .to.be.revertedWith("AgentBoard: points must be 1-100");
    await expect(board.connect(creator).createTask("Too many", 101, { value: ethers.parseEther("0.01") }))
      .to.be.revertedWith("AgentBoard: points must be 1-100");
  });

  it("approve credits points + pending BNB, but does NOT pay out immediately", async function () {
    const { board, creator, claimer } = await deploy();
    const before = await ethers.provider.getBalance(claimer.address);
    await finishTask(board, creator, claimer, "0.01", 10);
    const after = await ethers.provider.getBalance(claimer.address);
    // No direct payout in v2: the claimer only spent gas on claim + proof
    // (well under 0.001 ETH), and the 0.01 reward is still escrowed in the contract.
    expect(before - after).to.be.lt(ethers.parseEther("0.001"));
    expect(await ethers.provider.getBalance(await board.getAddress())).to.equal(ethers.parseEther("0.01"));
    expect(await board.points(claimer.address)).to.equal(10);
    expect(await board.pendingBNB(claimer.address)).to.equal(ethers.parseEther("0.01"));
    expect(await board.tasksCompleted(claimer.address)).to.equal(1);
    expect((await board.tasks(1)).status).to.equal(3); // Completed
  });

  it("claimBNB reverts below 100 points, succeeds at 100 and pays the pending balance", async function () {
    const { board, creator, claimer } = await deploy();
    // 9 tasks x 10 points = 90 points, 0.09 BNB pending.
    for (let i = 0; i < 9; i++) await finishTask(board, creator, claimer, "0.01", 10);
    expect(await board.points(claimer.address)).to.equal(90);
    await expect(board.connect(claimer).claimBNB())
      .to.be.revertedWith("AgentBoard: need 100 points to claim");
    // 10th task -> 100 points, 0.10 BNB pending.
    await finishTask(board, creator, claimer, "0.01", 10);
    expect(await board.points(claimer.address)).to.equal(100);
    expect(await board.pendingBNB(claimer.address)).to.equal(ethers.parseEther("0.10"));
    const before = await ethers.provider.getBalance(claimer.address);
    const tx = await board.connect(claimer).claimBNB();
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(claimer.address);
    expect(after - before + gas).to.equal(ethers.parseEther("0.10"));
    expect(await board.pendingBNB(claimer.address)).to.equal(0);
    // Points are a lifetime score: claiming does not spend them.
    expect(await board.points(claimer.address)).to.equal(100);
    // Nothing left to claim.
    await expect(board.connect(claimer).claimBNB())
      .to.be.revertedWith("AgentBoard: nothing to claim");
  });

  it("custom points per task count toward the 100 threshold", async function () {
    const { board, creator, claimer } = await deploy();
    await finishTask(board, creator, claimer, "0.01", 40);
    await finishTask(board, creator, claimer, "0.01", 60);
    expect(await board.points(claimer.address)).to.equal(100);
    expect(await board.pendingBNB(claimer.address)).to.equal(ethers.parseEther("0.02"));
    await expect(board.connect(claimer).claimBNB()).to.emit(board, "BNBClaimed");
  });

  it("cancel still refunds the creator and grants no points", async function () {
    const { board, creator, claimer } = await deploy();
    await board.connect(creator).createTask("T", 10, { value: ethers.parseEther("0.02") });
    await expect(board.connect(creator).cancelTask(1)).to.emit(board, "TaskCancelled");
    expect(await board.points(claimer.address)).to.equal(0);
    expect(await board.pendingBNB(claimer.address)).to.equal(0);
  });

  it("rejects createTask from a non-Agent-ID holder and claim by the creator", async function () {
    const { board, creator, stranger } = await deploy();
    await expect(board.connect(stranger).createTask("X", 10, { value: ethers.parseEther("0.01") }))
      .to.be.revertedWith("AgentBoard: caller holds no Agent ID");
    await board.connect(creator).createTask("T", 10, { value: ethers.parseEther("0.01") });
    await expect(board.connect(creator).claimTask(1))
      .to.be.revertedWith("AgentBoard: creator cannot claim own task");
  });

  it("gate OFF: anyone can use the board without an Agent ID (testnet mode)", async function () {
    const { board } = await deploy(false);
    expect(await board.GATE_ENABLED()).to.equal(false);
    // signers[2] and [3] never received a mock Agent ID in deploy().
    const [, , noIdCreator, noIdClaimer] = await ethers.getSigners();
    await board.connect(noIdCreator).createTask("Open task", 100, { value: ethers.parseEther("0.01") });
    await board.connect(noIdClaimer).claimTask(1);
    await board.connect(noIdClaimer).submitProof(1, "https://example.com/proof");
    await board.connect(noIdCreator).approveTask(1);
    expect(await board.points(noIdClaimer.address)).to.equal(100);
    expect(await board.pendingBNB(noIdClaimer.address)).to.equal(ethers.parseEther("0.01"));
    await expect(board.connect(noIdClaimer).claimBNB()).to.emit(board, "BNBClaimed");
    expect(await board.pendingBNB(noIdClaimer.address)).to.equal(0);
  });

  it("gate ON (default): GATE_ENABLED is true", async function () {
    const { board } = await deploy();
    expect(await board.GATE_ENABLED()).to.equal(true);
  });
});
