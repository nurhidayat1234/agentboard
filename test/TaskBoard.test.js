const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TaskBoard", function () {
  async function deploy() {
    const [creator, claimer, stranger] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentID");
    const mock = await Mock.deploy();
    const Board = await ethers.getContractFactory("TaskBoard");
    const board = await Board.deploy(await mock.getAddress());
    await mock.setBalance(creator.address, 1);
    await mock.setBalance(claimer.address, 1);
    // stranger holds no Agent ID on purpose
    return { board, mock, creator, claimer, stranger };
  }

  it("creates a task with escrowed reward", async function () {
    const { board, creator } = await deploy();
    await expect(board.connect(creator).createTask("Review README", { value: ethers.parseEther("0.01") }))
      .to.emit(board, "TaskCreated");
    const task = await board.tasks(1);
    expect(task.title).to.equal("Review README");
    expect(task.reward).to.equal(ethers.parseEther("0.01"));
    expect(task.status).to.equal(0); // Open
  });

  it("rejects createTask from a non-Agent-ID holder", async function () {
    const { board, stranger } = await deploy();
    await expect(board.connect(stranger).createTask("X", { value: ethers.parseEther("0.01") }))
      .to.be.revertedWith("AgentBoard: caller holds no Agent ID");
  });

  it("runs the full flow: claim -> proof -> approve -> payout", async function () {
    const { board, creator, claimer } = await deploy();
    await board.connect(creator).createTask("Review README", { value: ethers.parseEther("0.01") });
    await board.connect(claimer).claimTask(1);
    await board.connect(claimer).submitProof(1, "https://example.com/proof");
    const before = await ethers.provider.getBalance(claimer.address);
    const tx = await board.connect(creator).approveTask(1);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(claimer.address);
    // claimer is not the tx sender here, so no gas is deducted from them
    expect(after - before).to.equal(ethers.parseEther("0.01"));
    expect((await board.tasks(1)).status).to.equal(3); // Completed
    void gas;
  });

  it("refunds on cancel before claim", async function () {
    const { board, creator } = await deploy();
    await board.connect(creator).createTask("T", { value: ethers.parseEther("0.02") });
    await expect(board.connect(creator).cancelTask(1)).to.emit(board, "TaskCancelled");
    expect((await board.tasks(1)).status).to.equal(4); // Cancelled
  });

  it("rejects claim by the creator and by non-holders", async function () {
    const { board, creator, stranger } = await deploy();
    await board.connect(creator).createTask("T", { value: ethers.parseEther("0.01") });
    await expect(board.connect(creator).claimTask(1))
      .to.be.revertedWith("AgentBoard: creator cannot claim own task");
    await expect(board.connect(stranger).claimTask(1))
      .to.be.revertedWith("AgentBoard: caller holds no Agent ID");
  });
});
