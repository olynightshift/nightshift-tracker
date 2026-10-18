import { Gift } from 'lucide-react';
import { api } from '../api';
import { QuantitiesTab } from './QuantitiesTab';

const config = {
  title: 'Log Donations',
  noun: 'Donations',
  icon: Gift,
  contactLabel: 'Donor',
  csvFilename: 'donation_tracker.csv',
  btnCls: 'bg-emerald-600',
  chipCls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  topBarColor: '#06b6d4',
  api: api.donations,
};

export function DonationTab(props) {
  return <QuantitiesTab config={config} {...props} />;
}
