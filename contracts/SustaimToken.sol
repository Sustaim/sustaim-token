pragma solidity 0.8.12;

import "openzeppelin-solidity/contracts/access/AccessControl.sol";
import "openzeppelin-solidity/contracts/token/ERC1155/ERC1155.sol";

contract SustaimToken is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PM_ROLE = keccak256("PM_ROLE");

    // Use public variables and get rid of their getter functions
    // See https://docs.soliditylang.org/en/v0.8.17/contracts.html#getter-functions

    uint256 _totalTokenAmount;
    uint256 _totalBurnedTokenAmount;
    uint256 _numProjects;

    // Store this info off chain if you are deploying on mainnet, will save gas
    struct Project {
        string name;
        string description;
    }

    struct BatchAmounts {
        uint256 mintedAmount;
        uint256 burnedAmount;
    }

    // Project details per projectId
    mapping(uint256 => Project) _projects; // projectId=>project

    // Mapping of batches and Projects. Each batch can only consist of one project
    mapping(uint256 => uint256) _batchProjectMapping; //batchId=>projectId

    // batch => Project?

    // Mapping used to track the minted and burned amounts of tokens per batch
    mapping(uint256 => BatchAmounts) _batchBalance; // batchId=>BatchAmounts

    // Mapping used to track the minted and burned amounts of tokens per project
    mapping(uint256 => BatchAmounts) _projectBalance; //projectId=>batchAmounts

    constructor(string memory uri) ERC1155(uri) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Zero by default so not needed
        // _totalTokenAmount = 0;
        // _totalBurnedTokenAmount = 0;
        // _numProjects = 0;
    }

    // TODO

    // Set string inputs to external functions from memory location to calldata
    // There is no need to load from calldata into memory

    // Avoid unecessary rewrites where possible and apply fix on line 132

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setURI(string memory newuri) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not admin");
        _setURI(newuri);
    }

    function mint(
        address to,
        uint256 batchId,
        uint256 amount,
        uint256 projectId
    ) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        require(projectId > 0, "ProjectId must be larger than 0");
        // Mint batch
        _mint(to, batchId, amount, "");
        _totalTokenAmount += amount;
        _batchBalance[batchId].mintedAmount += amount;
        _projectBalance[projectId].mintedAmount += amount;
        // Assign project to batch
        _batchProjectMapping[batchId] = projectId;
    }

    function burn(
        address from,
        uint256 batchId,
        uint256 amount
    ) external {
        require(
            from == msg.sender || hasRole(BURNER_ROLE, msg.sender),
            "Caller not owner or burner"
        );
        _burn(from, batchId, amount);
        _totalBurnedTokenAmount += amount;
        _batchBalance[batchId].burnedAmount += amount;
        uint256 projectId = _batchProjectMapping[batchId];
        _projectBalance[projectId].burnedAmount += amount;
    }

    function addProject(
        uint projectId,
        string memory name,
        string memory description
    ) external {
        require(hasRole(PM_ROLE, msg.sender), "Caller not PM");
        require(
            bytes(_projects[projectId].name).length == 0,
            "Project already exists"
        );
        require(bytes(name).length > 0, "Project needs a name");
        require(projectId > 0, "ProjectId must be larger than 0");
        _projects[projectId] = Project({name: name, description: description});
        _numProjects += 1;
    }

    function updateProjectDescription(uint projectId, string memory description)
        external
    {
        require(hasRole(PM_ROLE, msg.sender), "Caller not PM");
        require(
            bytes(_projects[projectId].name).length != 0,
            "Project doesn't exists"
        );
        // This is cheaper as don't have to read and then rewrite name, as it stays the same
        _projects[projectId].description = description;
        // _projects[projectId] = Project({
        //     name: _projects[projectId].name,
        //     description: description
        // });
    }

    function updateProjectName(uint projectId, string memory name) external {
        require(hasRole(PM_ROLE, msg.sender), "Caller not PM");
        require(
            bytes(_projects[projectId].name).length != 0,
            "Project doesn't exists"
        );
        require(bytes(name).length > 0, "Project needs a name");
        _projects[projectId] = Project({
            name: name,
            description: _projects[projectId].description
        });
    }

    // Can get rid of these using public variables

    function showProject(uint256 projectId)
        external
        view
        virtual
        returns (Project memory)
    {
        return _projects[projectId];
    }

    function getProjectId(uint256 batchId)
        external
        view
        virtual
        returns (uint256)
    {
        return _batchProjectMapping[batchId];
    }

    function totalTokenAmount() external view virtual returns (uint256) {
        return _totalTokenAmount;
    }

    function totalBurnedTokenAmount() external view virtual returns (uint256) {
        return _totalBurnedTokenAmount;
    }

    function getNumProjects() external view virtual returns (uint256) {
        return _numProjects;
    }

    function getBatchAmounts(uint256 batchId)
        external
        view
        virtual
        returns (BatchAmounts memory)
    {
        return _batchBalance[batchId];
    }
}

//TODO: Optional: Add TRANSFERER and wrapper that allows transferer to transfer tokens on behalf of owner
