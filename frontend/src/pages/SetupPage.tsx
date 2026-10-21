import { Link } from 'react-router-dom';

const steps = [
  {
    title: '1. Add your TDCP site',
    text: 'Open TDCP Sites and use “Use my location” so the office address is filled from this computer.',
    to: '/sites',
    action: 'Open TDCP Sites',
  },
  {
    title: '2. Attach the attendance machine',
    text: 'On the office network, register the biometric device with its IP address. Do not expose the machine to the public internet.',
    to: '/devices',
    action: 'Register machine',
  },
  {
    title: '3. Test the connection',
    text: 'Use Test connection on the device row. A reachable ZKTeco machine shows online. Log download still waits for on-site verification.',
    to: '/devices',
    action: 'Test machine',
  },
  {
    title: '4. Enroll employees',
    text: 'Add from machine fills the user ID, then you enter name, department, shift start, shift end, and gender. Capture finger only while the machine is online. The fingerprint stays on the device.',
    to: '/employees',
    action: 'Enroll staff',
  },
  {
    title: '5. Watch the live dashboard',
    text: 'The dashboard refreshes every 12 seconds. When a new employee is saved, the bell and a browser notification update.',
    to: '/',
    action: 'Open dashboard',
  },
];

export default function SetupPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">Office setup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Connect this attendance system to your office machine in five steps.
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.title} className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
            <h2 className="font-display font-semibold text-tdcp-navy">{step.title}</h2>
            <p className="text-sm text-slate-600 mt-2">{step.text}</p>
            <Link to={step.to} className="inline-block mt-3 text-sm font-semibold text-tdcp-green">
              {step.action}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
