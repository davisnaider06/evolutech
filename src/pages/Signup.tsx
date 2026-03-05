import React from 'react';
import { Navigate } from 'react-router-dom';

const Signup: React.FC = () => {
  return <Navigate to="/login" replace />;
};

export default Signup;
