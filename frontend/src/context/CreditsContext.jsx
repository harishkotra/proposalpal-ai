// client/src/context/CreditsContext.jsx
import { createContext, useState, useContext, useCallback } from 'react';
import axios from 'axios';
import { useAddress } from '@meshsdk/react';
import { useEffect } from 'react';

const CreditsContext = createContext();

export const useCredits = () => useContext(CreditsContext);

export const CreditsProvider = ({ children }) => {
    const [credits, setCredits] = useState({ remaining: 0, consumed: 0, total: 0 });
    const [loadingCredits, setLoadingCredits] = useState(true);
    const address = useAddress();

    const fetchCredits = useCallback(async () => {
        if (!address) {
            setCredits({ remaining: 0, consumed: 0, total: 0 });
            setLoadingCredits(false);
            return;
        }
        try {
            setLoadingCredits(true);
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/credits/${address}`);
            setCredits(response.data);
        } catch (error) {
            console.error("Failed to fetch credits:", error);
        } finally {
            setLoadingCredits(false);
        }
    }, [address]);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    const value = { credits, loadingCredits, fetchCredits };

    return (
        <CreditsContext.Provider value={value}>
            {children}
        </CreditsContext.Provider>
    );
};