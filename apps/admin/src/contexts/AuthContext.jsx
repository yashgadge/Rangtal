import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'ADMIN' or 'SUPER_ADMIN'
  const [status, setStatus] = useState('INITIALIZING'); // 'INITIALIZING', 'AUTHENTICATED', 'UNAUTHENTICATED', 'DISABLED', 'ERROR'
  const [adminData, setAdminData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 1. Check custom claims
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const claims = tokenResult.claims;
          
          const isMasterAdmin = firebaseUser.email === 'yashgadge11155@gmail.com';
          
          if (!claims.admin && !claims.super_admin && !isMasterAdmin && !claims.volunteer) {
            // Not an admin or volunteer. Reject.
            await signOut(auth);
            setUser(null);
            setRole(null);
            setStatus('UNAUTHENTICATED');
            return;
          }

          let data = null;
          
          if (!isMasterAdmin) {
            // 2. Fetch admin profile (or volunteer profile) to check active status
            const collectionName = claims.volunteer ? 'volunteers' : 'admins';
            const userDoc = await getDoc(doc(db, collectionName, firebaseUser.uid));
            
            if (!userDoc.exists()) {
              await signOut(auth);
              setUser(null);
              setStatus('ERROR');
              return;
            }
            data = userDoc.data();
            
            if (data && data.status === 'DISABLED') {
              await signOut(auth);
              setUser(null);
              setStatus('DISABLED');
              return;
            }
          }

          if (claims.super_admin || isMasterAdmin) {
            setRole('SUPER_ADMIN');
          } else if (claims.admin) {
            setRole('ADMIN');
          } else if (claims.volunteer) {
            setRole('VOLUNTEER');
          }
          
          setAdminData(data || { name: 'Master Admin', email: firebaseUser.email });
          setUser(firebaseUser);
          setStatus('AUTHENTICATED');
        } catch (error) {
          console.error("Auth context error:", error);
          setStatus('ERROR');
        }
      } else {
        setUser(null);
        setRole(null);
        setAdminData(null);
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
    role,
    adminData,
    status,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
