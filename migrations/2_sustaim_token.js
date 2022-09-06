const SustaimToken = artifacts.require("SustaimToken");

module.exports = function (deployer) {
  deployer.deploy(SustaimToken, ""); //TODO real URI?
};
