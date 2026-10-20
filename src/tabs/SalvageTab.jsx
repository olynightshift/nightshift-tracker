import { Package } from 'lucide-react';
import { api } from '../api';
import { QuantitiesTab } from './QuantitiesTab';

const config = {
  title: 'Log Salvage',
  noun: 'Salvage',
  icon: Package,
  contactLabel: 'Contact',
  csvFilename: 'salvage.csv',
  btnCls: 'bg-purple-600',
  chipCls: 'bg-purple-50 border-purple-200 text-purple-700',
  topBarColor: '#8b5cf6',
  weightType: 'Pounds',
  api: api.salvage,
};

export function SalvageTab(props) {
  return <QuantitiesTab config={config} {...props} />;
}
