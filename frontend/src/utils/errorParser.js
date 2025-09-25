/**
 * Parses wallet errors from MeshJS to provide a user-friendly message.
 * @param {any} error - The error object caught in a try/catch block.
 * @returns {string} - A user-friendly error message.
 */
export const parseWalletError = (error) => {
    // Log the full error for debugging
    console.error("Wallet Error Caught:", error);

    // MeshJS often returns an object with an 'info' property for user-facing messages
    if (error && typeof error === 'object' && error.info) {
        return error.info;
    }

    // Sometimes the message is directly on the error object
    if (error && error.message) {
        return error.message;
    }

    // Fallback for unexpected error formats
    return "An unexpected error occurred with your wallet. Please check the console for details.";
};