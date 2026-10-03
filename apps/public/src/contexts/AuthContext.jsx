import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('INITIALIZING'); // 'INITIALIZING', 'AUTHENTICATED', 'UNAUTHENTICATED', 'ERROR'
  const [participantData, setParticipantData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const partDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let data = null;
          
          if (!partDoc.exists()) {
            // First time login - initialize basic user record
            data = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || '',
              role: 'PARTICIPANT',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), data);
          } else {
            data = partDoc.data();
          }

          setParticipantData(data);
          setUser(firebaseUser);
          setStatus('AUTHENTICATED');
        } catch (error) {
          console.error("Auth context error:", error);
          setStatus('ERROR');
        }
      } else {
        setUser(null);
        setParticipantData(null);
        setStatus('UNAUTHENTICATED');
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    participantData,
    status,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
