/**
 * Hardcoded HR function areas, tasks, and team members (admin / operations seed).
 */
const MEMBERS = [
    { name: 'Mr. Deepal', role: 'GM', sortOrder: 0 },
    { name: 'Mr. Bandara', role: 'Administration Manager', sortOrder: 1 },
    { name: 'Dr. Heshani', role: 'AM – Admin & Skill Development', sortOrder: 2 },
    { name: 'Danushi', role: 'AM – HR & Administration', sortOrder: 3 },
    { name: 'Chamara', role: 'Executive – Data Analysis', sortOrder: 4 },
    { name: 'Shehan', role: 'Executive – Sales Administration', sortOrder: 5 },
    { name: 'Chamuditha', role: 'Executive', sortOrder: 6 },
    { name: 'Nayanathara', role: 'Executive', sortOrder: 7 }
];

/** @type {{ title: string, category: string, frequency: string, tasks: { label: string, subLabel?: string }[] }[]} */
const AREAS = [
    {
        title: 'Recruitment',
        category: 'People & HR',
        frequency: 'Ongoing',
        tasks: [
            { label: 'finding candidates', subLabel: 'Sourcing' },
            { label: 'Interview calling', subLabel: 'Scheduling' },
            { label: 'Personal file management', subLabel: 'Docs' },
            {
                label: 'Completing recruiments',
                subLabel: 'Welfare forms, orientation & fingerprint registration'
            }
        ]
    },
    {
        title: 'New Employees',
        category: 'People & HR',
        frequency: 'Monthly',
        tasks: [{ label: 'Joined staff updates', subLabel: 'New joiners list and onboarding details' }]
    },
    {
        title: 'Appointment Letter',
        category: 'People & HR',
        frequency: 'Ongoing',
        tasks: [{ label: 'Appointment letter', subLabel: 'Issued on joining' }]
    },
    {
        title: 'Confirmation Letter',
        category: 'People & HR',
        frequency: 'Ongoing',
        tasks: [{ label: 'Confirmation letter', subLabel: 'Issued after probation' }]
    },
    {
        title: 'Insurance Policy (Life Insurance)',
        category: 'Finance',
        frequency: 'Monthly',
        tasks: [
            { label: 'Policy renewal' },
            {
                label: 'New members adding',
                subLabel: 'Email to accounts, invoice raising & payment settlement'
            },
            { label: 'Resigned members removing' },
            { label: 'Claim handling' }
        ]
    },
    {
        title: 'General Insurance Policy',
        category: 'Finance',
        frequency: 'Monthly',
        tasks: [
            { label: 'Policy renewal', subLabel: 'Including volunteer coverage' },
            {
                label: 'New members adding',
                subLabel: 'Email to accounts, invoice raising & payment settlement'
            },
            { label: 'Resigned members removing' },
            { label: 'Claim handling' }
        ]
    },
    {
        title: 'Utility Bill Payments Settlement',
        category: 'Finance',
        frequency: 'Monthly',
        tasks: [
            { label: 'Water bills', subLabel: 'By location list' },
            { label: 'Electricity bills', subLabel: 'By location list' },
            { label: 'Telephone bills', subLabel: 'By location list' },
            { label: 'Assessment tax' }
        ]
    },
    {
        title: 'Housekeeping',
        category: 'Operations',
        frequency: 'Monthly',
        tasks: [
            { label: 'Chemical purchase consumers' },
            { label: 'Location cleanliness checking' },
            { label: 'Location modifications' }
        ]
    },
    {
        title: 'Resigned Employee',
        category: 'People & HR',
        frequency: 'Ongoing',
        tasks: [
            { label: 'Resigned Employee Registry', subLabel: 'Manage Exit Clearance Checklist' }
        ]
    },
    {
        title: 'Event Calendar',
        category: 'Operations',
        frequency: 'Annual',
        tasks: [
            { label: 'Annual trip', subLabel: 'Jan 1' },
            { label: 'Pirith ceremony', subLabel: 'Feb ~' },
            { label: 'Avurudu festival', subLabel: 'Apr 13' },
            { label: 'Christmas party', subLabel: 'Dec 25' },
            { label: 'Afternoon workshop', subLabel: 'TBD – W' }
        ]
    },
    {
        title: 'Incentive / Commission / Other Allowances / Bonus',
        category: 'Finance',
        frequency: 'Monthly',
        tasks: [
            { label: 'Weekend payments', subLabel: 'Monthly|Regular' },
            { label: 'Event allowances', subLabel: 'Per event|Event' },
            { label: 'Holiday payments', subLabel: 'Monthly|Holiday' }
        ]
    },
    {
        title: 'Leave Handling',
        category: 'People & HR',
        frequency: 'Monthly',
        tasks: [
            { label: 'Leave application processing' },
            { label: 'Late coming register' },
            { label: 'No pay list preparation' },
            { label: 'Annual leave balance payments' }
        ]
    },
    {
        title: 'Vehicle Handling',
        category: 'Vehicle',
        frequency: 'Monthly',
        tasks: [
            { label: 'Vehicle maintenance & service repairs', subLabel: 'Fleet upkeep' },
            { label: 'Vehicle insurance renewal', subLabel: 'Policy cycle' },
            { label: 'License renewal', subLabel: 'Compliance' },
            { label: 'Vehicle checking', subLabel: 'Inspections' }
        ]
    },
    {
        title: 'Reward / Awards & Rewards Handling',
        category: 'People & HR',
        frequency: 'Monthly',
        tasks: [
            { label: 'Best employee', subLabel: 'Monthly|Performance' },
            { label: 'Long service award', subLabel: 'Annually|Years of service' },
            { label: 'Attendance allowance', subLabel: 'Monthly|Full attendance' },
            { label: 'Best attendance reward', subLabel: 'Monthly|Top ranking' },
            { label: 'Sales reward', subLabel: 'Monthly|Highest sales achievement' }
        ]
    },
    {
        title: 'Skill Development',
        category: 'People & HR',
        frequency: 'Monthly',
        tasks: [
            {
                label: 'Training program coordination',
                subLabel: 'Coordinate with Dr. Heshani'
            },
            { label: 'Afternoon workshop setup' },
            { label: 'Staff development tracking' }
        ]
    },
    {
        title: 'Welfare Society',
        category: 'People & HR',
        frequency: 'Monthly',
        tasks: [
            { label: 'Welfare fund contributions' },
            { label: 'Welfare activity planning' },
            { label: 'Monthly society meeting' }
        ]
    }
];

module.exports = { MEMBERS, AREAS };
