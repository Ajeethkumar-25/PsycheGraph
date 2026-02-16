import { useParams } from 'react-router-dom';
import SessionRecorder from '../../components/SessionRecorder'; // Reusing existing component

export default function DoctorSessionMode() {
    const { patientId } = useParams();

    // We can wrap the SessionRecorder or build a more complex page around it
    // For now, reusing the powerful SessionRecorder is the best bet as it has STT, Audio, etc.

    return (
        <div className="h-[calc(100vh-100px)]">
            <SessionRecorder patientId={parseInt(patientId)} onClose={() => window.history.back()} />
        </div>
    );
}
