import { expect, use } from "chai";
import { Contract } from "ethers";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import SustaimToken from "../build/SustaimToken.json";

use(solidity);

const GAS_LIMIT = 1000000;
const MINT_AMOUNT = 1000;
const PROJECT_ID = 1;
const PROJECT_NAME = "Project Name";
const PROJECT_DESCRIPTION = "Project Description";
const BATCH_ID = 1;

describe("SustaimToken", () => {
  const provider = new MockProvider();
  const [ownerWallet, minterWallet, burnerWallet, pmWallet, customerWallet] =
    provider.getWallets();
  let token: Contract;

  beforeEach(async () => {
    token = await deployContract(ownerWallet, SustaimToken);

    let MINTER_ROLE = await token.MINTER_ROLE();
    let BURNER_ROLE = await token.BURNER_ROLE();
    let PM_ROLE = await token.PM_ROLE();
    await token.grantRole(MINTER_ROLE, minterWallet.address);
    await token.grantRole(BURNER_ROLE, burnerWallet.address);
    await token.grantRole(PM_ROLE, pmWallet.address);
  });

  describe("Deploy Contract", () => {
    it("Should deploy", async () => {
      expect(token.address).to.be.properAddress;
    });

    it("Owner should be admin", async () => {
      let ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(ADMIN_ROLE, ownerWallet.address)).to.be.true;
    });
  });

  describe("Project Management", () => {
    it("Should revert if user not PM", async () => {
      await expect(
        token.addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION)
      ).to.be.revertedWith("Caller not PM");
    });

    it("Should revert if trying to add project with id that already exists", async () => {
      await token
        .connect(pmWallet)
        .addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });

      await expect(
        token
          .connect(pmWallet)
          .addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION, {
            gasLimit: GAS_LIMIT,
          })
      ).to.be.revertedWith("Project already exists");
    });

    it("Should revert if trying to add project without name", async () => {
      await expect(
        token
          .connect(pmWallet)
          .addProject(PROJECT_ID, "", PROJECT_DESCRIPTION, {
            gasLimit: GAS_LIMIT,
          })
      ).to.be.revertedWith("Project needs a name");
    });

    it("Should revert if trying to add project with id <= 0", async () => {
      await expect(
        token
          .connect(pmWallet)
          .addProject(0, PROJECT_NAME, PROJECT_DESCRIPTION, {
            gasLimit: GAS_LIMIT,
          })
      ).to.be.revertedWith("ProjectId must be larger than 0");
    });

    it("Should create a new project", async () => {
      expect(await token.getNumProjects()).to.be.eq(0);
      await token
        .connect(pmWallet)
        .addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });
      const project = await token.showProject(PROJECT_ID);
      expect(project.name).to.be.eq(PROJECT_NAME);
      expect(project.description).to.be.eq(PROJECT_DESCRIPTION);
      expect(await token.getNumProjects()).to.be.eq(1);
    });

    it("Should revert if trying to rename to empty string", async () => {
      await token
        .connect(pmWallet)
        .addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });

      await expect(
        token.connect(pmWallet).updateProjectName(PROJECT_ID, "")
      ).to.be.revertedWith("Project needs a name");
    });

    it("Should rename project", async () => {
      await token
        .connect(pmWallet)
        .addProject(PROJECT_ID, "Wrong name", PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });

      await token
        .connect(pmWallet)
        .updateProjectName(PROJECT_ID, PROJECT_NAME, {
          gasLimit: GAS_LIMIT,
        });
      const project = await token.showProject(PROJECT_ID);
      expect(project.name).to.be.eq(PROJECT_NAME);
    });

    it("Should update project description", async () => {
      await token.connect(pmWallet).addProject(PROJECT_ID, PROJECT_NAME, "", {
        gasLimit: GAS_LIMIT,
      });

      let project = await token.showProject(PROJECT_ID);
      expect(project.description).to.be.eq("");
      await token
        .connect(pmWallet)
        .updateProjectDescription(PROJECT_ID, PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });

      project = await token.showProject(PROJECT_ID);
      expect(project.description).to.be.eq(PROJECT_DESCRIPTION);
    });
  });

  describe("Minting", () => {
    beforeEach(async () => {
      // Create a project where we can mint tokens for
      await token
        .connect(pmWallet)
        .addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });
    });

    it("Should revert if user not MINTER", async () => {
      await expect(
        token.mint(ownerWallet.address, BATCH_ID, MINT_AMOUNT, PROJECT_ID, {
          gasLimit: GAS_LIMIT,
        })
      ).to.revertedWith("Caller is not a minter");
    });

    it("Should mint the given amount of tokens to the specified project", async () => {
      expect(await token.balanceOf(ownerWallet.address, BATCH_ID)).to.be.eq(0);
      expect(await token.totalTokenAmount()).to.be.eq(0);

      await token
        .connect(minterWallet)
        .mint(ownerWallet.address, BATCH_ID, MINT_AMOUNT, PROJECT_ID, {
          gasLimit: GAS_LIMIT,
        });

      expect(await token.balanceOf(ownerWallet.address, BATCH_ID)).to.be.eq(
        MINT_AMOUNT
      );
      expect(await token.totalTokenAmount()).to.be.eq(MINT_AMOUNT);

      const batchBalance = await token.getBatchAmounts(BATCH_ID);
      expect(batchBalance.mintedAmount).to.be.eq(MINT_AMOUNT);
      expect(batchBalance.burnedAmount).to.be.eq(0);
    });
  });

  describe("Burning", () => {
    beforeEach(async () => {
      // Create a project where we can mint tokens for
      await token
        .connect(pmWallet)
        .addProject(PROJECT_ID, PROJECT_NAME, PROJECT_DESCRIPTION, {
          gasLimit: GAS_LIMIT,
        });

      // Mint tokens
      await token
        .connect(minterWallet)
        .mint(ownerWallet.address, BATCH_ID, MINT_AMOUNT, PROJECT_ID, {
          gasLimit: GAS_LIMIT,
        });

      await token
        .connect(ownerWallet)
        .safeTransferFrom(
          ownerWallet.address,
          customerWallet.address,
          BATCH_ID,
          MINT_AMOUNT,
          "0x"
        );
    });
    it("Should revert if caller is not owner or burner", async () => {
      expect(await token.balanceOf(customerWallet.address, BATCH_ID)).to.be.eq(
        MINT_AMOUNT
      );
      await expect(
        token
          .connect(minterWallet)
          .burn(customerWallet.address, BATCH_ID, MINT_AMOUNT)
      ).to.be.revertedWith("Caller not owner or burner");
    });

    it("Should burn the expected amount if burner", async () => {
      expect(await token.balanceOf(customerWallet.address, BATCH_ID)).to.be.eq(
        MINT_AMOUNT
      );
      expect(await token.totalBurnedTokenAmount()).to.be.eq(0);
      expect(await token.totalTokenAmount()).to.be.eq(MINT_AMOUNT);

      await token
        .connect(burnerWallet)
        .burn(customerWallet.address, BATCH_ID, MINT_AMOUNT);

      expect(await token.balanceOf(customerWallet.address, BATCH_ID)).to.be.eq(
        0
      );
      expect(await token.totalBurnedTokenAmount()).to.be.eq(MINT_AMOUNT);
      expect(await token.totalTokenAmount()).to.be.eq(MINT_AMOUNT);

      const batchBalance = await token.getBatchAmounts(BATCH_ID);
      expect(batchBalance.mintedAmount).to.be.eq(MINT_AMOUNT);
      expect(batchBalance.burnedAmount).to.be.eq(MINT_AMOUNT);
    });

    it("Should burn the expected amount if owner", async () => {
      expect(await token.balanceOf(customerWallet.address, BATCH_ID)).to.be.eq(
        MINT_AMOUNT
      );

      await token
        .connect(customerWallet)
        .burn(customerWallet.address, BATCH_ID, MINT_AMOUNT);

      expect(await token.balanceOf(customerWallet.address, BATCH_ID)).to.be.eq(
        0
      );

      const batchBalance = await token.getBatchAmounts(BATCH_ID);
      expect(batchBalance.mintedAmount).to.be.eq(MINT_AMOUNT);
      expect(batchBalance.burnedAmount).to.be.eq(MINT_AMOUNT);
    });

    it("Should revert if more burned than available", async () => {
      await expect(
        token
          .connect(burnerWallet)
          .burn(customerWallet.address, BATCH_ID, MINT_AMOUNT + 1)
      ).to.be.revertedWith("ERC1155: burn amount exceeds balance");
    });
  });
});
