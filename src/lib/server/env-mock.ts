
import 'dotenv/config';

// Mock for $env/dynamic/private
export const env = process.env;

// Mock for $env/dynamic/public
export const publicEnv = process.env; // Simplified for CLI

// Mock for $env/static/private
// Note: Static envs are usually inlined by Vite. For CLI, we just use process.env.
export default process.env; 
