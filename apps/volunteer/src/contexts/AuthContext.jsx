import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('INITIALIZING'); // 'INITIALIZING', 'AUTHENTICATED', 'UNAUTHENTICATED', 'DISABLED', 'ERROR'
  const [volunteerData, setVolunteerData] = useState(null);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const claims = tokenResult.claims;
          
          if (firebaseUser.email === 'yashgadge11155@gmail.com') {
            setPermissions(["SCAN_PASS", "MANUAL_CHECKIN", "VIEW_HISTORY"]);
            setVolunteerData({ name: "Super Admin", status: "ACTIVE", permissions: ["SCAN_PASS"] });
            setUser(firebaseUser);
            setStatus('AUTHENTICATED');
            return;
          }

          if (!claims.volunteer) {
            await signOut(auth);
            setUser(null);
            setStatus('UNAUTHENTICATED');
            return;
          }

          const volDoc = await getDoc(doc(db, 'volunteers', firebaseUser.uid));
          if (!volDoc.exists()) {
            await signOut(auth);
            setUser(null);
            setStatus('ERROR');
            return;
          }

          const data = volDoc.data();
          if (data.status === 'DISABLED' || data.active === false) {
            await signOut(auth);
            setUser(null);
            setStatus('DISABLED');
            return;
          }

          setPermissions(data.permissions || []);
          setVolunteerData(data);
          setUser(firebaseUser);
          setStatus('AUTHENTICATED');
        } catch (error) {
          console.error("Auth context error:", error);
          setStatus('ERROR');
        }
      } else {
        setUser(null);
        setVolunteerData(null);
        setPermissions([]);
        setStatus('UNAUTHENTICATED');
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const hasPermission = (permission) => permissions.includes(permission);

  const value = {
    user,
    volunteerData,
    permissions,
    hasPermission,
    status,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
