import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import Navigation from './components/navigation/Navigation.jsx';
import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Account from './pages/Account.jsx';
import PassViewer from './pages/PassViewer.jsx';

gsap.registerPlugin(ScrollTrigger);

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/pass/:registrationId" element={<PassViewer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
