// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AegisLedger
 * @notice On-chain loan ledger for Aegis Underwriter - Autonomous AI Lending Agent
 * @dev Records active loans, due dates, and handles USD₮ repayments
 * @author Aegis Team - Tether Hackathon Galactica
 */
contract AegisLedger is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===========================================
    // STATE VARIABLES
    // ===========================================

    /// @notice The agent (treasury) address that can issue loans
    address public immutable agent;

    /// @notice The USD₮ token used for loans and repayments
    IERC20 public immutable usdtToken;

    /// @notice Loan structure containing all loan details
    struct Loan {
        uint256 amount;          // Principal amount in USDT (6 decimals)
        uint256 interestRate;    // Interest rate in basis points (e.g., 500 = 5%)
        uint256 dueDate;         // Unix timestamp when loan is due
        uint256 totalRepayment;  // Total amount to repay (principal + interest)
        bool isRepaid;           // Whether the loan has been repaid
        bool isActive;           // Whether the loan exists
    }

    /// @notice Mapping of borrower address to their loan
    mapping(address => Loan) public loans;

    /// @notice Array of all borrower addresses (for heartbeat iteration)
    address[] public borrowers;

    /// @notice Mapping to check if an address is already a borrower
    mapping(address => bool) public isBorrower;

    /// @notice Total number of active loans
    uint256 public activeLoanCount;

    /// @notice Total value of all active loans
    uint256 public totalActiveValue;

    // ===========================================
    // EVENTS
    // ===========================================

    event LoanIssued(
        address indexed borrower,
        uint256 amount,
        uint256 interestRate,
        uint256 dueDate,
        uint256 totalRepayment
    );

    event LoanRepaid(
        address indexed borrower,
        uint256 amount,
        uint256 timestamp
    );

    event DefaultDetected(
        address indexed borrower,
        uint256 amount,
        uint256 dueDate
    );

    // ===========================================
    // MODIFIERS
    // ===========================================

    /// @notice Restricts function access to only the agent (treasury)
    modifier onlyAgent() {
        require(msg.sender == agent, "AegisLedger: caller is not the agent");
        _;
    }

    // ===========================================
    // CONSTRUCTOR
    // ===========================================

    /**
     * @notice Initializes the AegisLedger contract
     * @param _agent The agent (treasury) address that will issue loans
     * @param _usdtToken The USD₮ token contract address
     */
    constructor(address _agent, address _usdtToken) {
        require(_agent != address(0), "AegisLedger: agent is zero address");
        require(_usdtToken != address(0), "AegisLedger: USDT is zero address");

        agent = _agent;
        usdtToken = IERC20(_usdtToken);
    }

    // ===========================================
    // AGENT FUNCTIONS
    // ===========================================

    /**
     * @notice Issues a new loan to a borrower (called by agent after LLM approval)
     * @param borrower The address receiving the loan
     * @param amount The loan principal amount (in USDT smallest units, 6 decimals)
     * @param interestRate Interest rate in basis points (500 = 5%)
     * @param durationDays Number of days until loan is due
     */
    function issueLoan(
        address borrower,
        uint256 amount,
        uint256 interestRate,
        uint256 durationDays
    ) external onlyAgent nonReentrant {
        require(borrower != address(0), "AegisLedger: borrower is zero address");
        require(amount > 0, "AegisLedger: amount must be greater than 0");
        require(durationDays > 0, "AegisLedger: duration must be greater than 0");
        require(!loans[borrower].isActive, "AegisLedger: borrower has active loan");

        // Calculate due date and total repayment
        uint256 dueDate = block.timestamp + (durationDays * 1 days);
        uint256 interestAmount = (amount * interestRate) / 10000;
        uint256 totalRepayment = amount + interestAmount;

        // Create the loan record
        loans[borrower] = Loan({
            amount: amount,
            interestRate: interestRate,
            dueDate: dueDate,
            totalRepayment: totalRepayment,
            isRepaid: false,
            isActive: true
        });

        // Track borrower for heartbeat iteration
        if (!isBorrower[borrower]) {
            borrowers.push(borrower);
            isBorrower[borrower] = true;
        }

        // Update statistics
        activeLoanCount++;
        totalActiveValue += amount;

        emit LoanIssued(borrower, amount, interestRate, dueDate, totalRepayment);
    }

    // ===========================================
    // BORROWER FUNCTIONS
    // ===========================================

    /**
     * @notice Allows a borrower to repay their loan
     * @dev Borrower must have approved this contract to spend their USDT
     */
    function repayLoan() external nonReentrant {
        Loan storage loan = loans[msg.sender];

        require(loan.isActive, "AegisLedger: no active loan found");
        require(!loan.isRepaid, "AegisLedger: loan already repaid");

        uint256 repaymentAmount = loan.totalRepayment;

        // Transfer USDT from borrower to agent (treasury)
        usdtToken.safeTransferFrom(msg.sender, agent, repaymentAmount);

        // Mark loan as repaid
        loan.isRepaid = true;
        loan.isActive = false;

        // Update statistics
        activeLoanCount--;
        totalActiveValue -= loan.amount;

        emit LoanRepaid(msg.sender, repaymentAmount, block.timestamp);
    }

    /**
     * @notice Allows partial repayment (future enhancement)
     * @param amount Amount to repay
     */
    function partialRepay(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];

        require(loan.isActive, "AegisLedger: no active loan found");
        require(!loan.isRepaid, "AegisLedger: loan already repaid");
        require(amount > 0, "AegisLedger: amount must be greater than 0");
        require(amount <= loan.totalRepayment, "AegisLedger: amount exceeds debt");

        // Transfer USDT from borrower to agent
        usdtToken.safeTransferFrom(msg.sender, agent, amount);

        // Reduce total repayment
        loan.totalRepayment -= amount;

        // If fully repaid, close the loan
        if (loan.totalRepayment == 0) {
            loan.isRepaid = true;
            loan.isActive = false;
            activeLoanCount--;
            totalActiveValue -= loan.amount;

            emit LoanRepaid(msg.sender, amount, block.timestamp);
        }
    }

    // ===========================================
    // VIEW FUNCTIONS (For Heartbeat Monitoring)
    // ===========================================

    /**
     * @notice Gets the loan details for a borrower
     * @param borrower The borrower's address
     * @return The Loan struct for the borrower
     */
    function getLoan(address borrower) external view returns (Loan memory) {
        return loans[borrower];
    }

    /**
     * @notice Checks if a loan is in default (past due and not repaid)
     * @param borrower The borrower's address
     * @return bool True if the loan is in default
     */
    function isInDefault(address borrower) external view returns (bool) {
        Loan storage loan = loans[borrower];
        return loan.isActive && !loan.isRepaid && block.timestamp > loan.dueDate;
    }

    /**
     * @notice Gets all borrowers with active loans (for heartbeat)
     * @return Array of borrower addresses
     */
    function getAllBorrowers() external view returns (address[] memory) {
        return borrowers;
    }

    /**
     * @notice Gets the count of all borrowers (including historical)
     * @return The total number of borrowers
     */
    function getBorrowerCount() external view returns (uint256) {
        return borrowers.length;
    }

    /**
     * @notice Gets borrowers who are currently in default
     * @return defaulters Array of addresses in default
     * @return amounts Array of corresponding default amounts
     */
    function getDefaulters() external view returns (
        address[] memory defaulters,
        uint256[] memory amounts
    ) {
        // First pass: count defaulters
        uint256 defaultCount = 0;
        for (uint256 i = 0; i < borrowers.length; i++) {
            Loan storage loan = loans[borrowers[i]];
            if (loan.isActive && !loan.isRepaid && block.timestamp > loan.dueDate) {
                defaultCount++;
            }
        }

        // Allocate arrays
        defaulters = new address[](defaultCount);
        amounts = new uint256[](defaultCount);

        // Second pass: populate arrays
        uint256 index = 0;
        for (uint256 i = 0; i < borrowers.length; i++) {
            Loan storage loan = loans[borrowers[i]];
            if (loan.isActive && !loan.isRepaid && block.timestamp > loan.dueDate) {
                defaulters[index] = borrowers[i];
                amounts[index] = loan.totalRepayment;
                index++;
            }
        }

        return (defaulters, amounts);
    }

    /**
     * @notice Gets time remaining until a loan is due
     * @param borrower The borrower's address
     * @return secondsRemaining Seconds until due (0 if already past due)
     */
    function getTimeUntilDue(address borrower) external view returns (uint256 secondsRemaining) {
        Loan storage loan = loans[borrower];
        if (!loan.isActive || loan.isRepaid || block.timestamp >= loan.dueDate) {
            return 0;
        }
        return loan.dueDate - block.timestamp;
    }

    // ===========================================
    // AGENT ADMIN FUNCTIONS
    // ===========================================

    /**
     * @notice Marks a loan as defaulted and emits event (called by heartbeat)
     * @param borrower The defaulting borrower's address
     */
    function markDefault(address borrower) external onlyAgent {
        Loan storage loan = loans[borrower];
        require(loan.isActive && !loan.isRepaid, "AegisLedger: no active loan");
        require(block.timestamp > loan.dueDate, "AegisLedger: loan not yet due");

        emit DefaultDetected(borrower, loan.totalRepayment, loan.dueDate);
    }
}
