import { useContext } from 'react';
import { DisplayContext } from '../context/displayStore';

export const useDisplay = () => useContext(DisplayContext);
