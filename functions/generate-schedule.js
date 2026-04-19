// Generate Schedule Edge Function with Improved Error Handling

import { createScheduledTask } from 'supabase';

export default async function generateSchedule(req, res) {
    try {
        const task = await createScheduledTask(req.body);
        res.status(200).json({ success: true, task });
    } catch (error) {
        // Improved error handling
        console.error('Error generating schedule:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
}
// Timeout setting 
export const config = {
    runtime: 'edge',
    maxDuration: 10,
};
