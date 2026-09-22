import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const BrokerContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useBroker = () => useContext(BrokerContext);

export const BrokerProvider = ({ children }) => {
  const [broker, setBroker] = useState(null);
  const [loadingBroker, setLoadingBroker] = useState(true);

  useEffect(() => {
    const initBroker = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        let slug = params.get('ref');

        if (!slug) {
          const stored = sessionStorage.getItem('activeBroker');
          if (stored) {
            setBroker(JSON.parse(stored));
          }
          setLoadingBroker(false);
          return;
        }

        const brokerDoc = await getDoc(doc(db, 'brokers', slug));
        if (brokerDoc.exists()) {
          const brokerData = brokerDoc.data();
          setBroker(brokerData);
          sessionStorage.setItem('activeBroker', JSON.stringify(brokerData));
        } else {
          // If ref is invalid, don't clear existing valid session, just ignore the ref
          const stored = sessionStorage.getItem('activeBroker');
          if (stored) {
            setBroker(JSON.parse(stored));
          }
        }
      } catch (error) {
        console.error("Error fetching broker data:", error);
      } finally {
        setLoadingBroker(false);
      }
    };

    initBroker();
  }, []);

  return (
    <BrokerContext.Provider value={{ broker, loadingBroker }}>
      {children}
    </BrokerContext.Provider>
  );
};
