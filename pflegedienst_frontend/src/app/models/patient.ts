export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  notes: string;
}

export interface TreatingDoctor {
  name: string;
  specialty: string;
  phone: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface LegalGuardian {
  name: string;
  phone: string;
  relationship: string;
}

export interface ResponsibleEmployee {
  id: number;
  name: string;
  email: string;
}

export interface PatientListItem {
  id: number;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  status: string;
  careLevel: string | null;
  street: string | null;
  houseNumber: string | null;
  zipCode: string | null;
  city: string | null;
  phone: string | null;
  responsibleEmployees: ResponsibleEmployee[];
  createdAt: string;
}

export interface Patient {
  id: number;
  patientNumber: string;
  status: string;

  // Stammdaten
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;

  // Kontakt
  email: string;
  phone: string;
  mobilePhone: string;

  // Adresse
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;

  // Versicherung
  insuranceType: string;
  insuranceProvider: string;
  insuranceNumber: string;

  // Pflegedaten
  careLevel: string;
  careLevelSince: string;
  diagnoses: string[];
  allergies: string[];
  medications: Medication[];
  careNotes: string;
  livingSituation: string;
  mobility: string;
  nutrition: string;
  communicationAbility: string;

  // Ärzte & Kontakte
  treatingDoctors: TreatingDoctor[];
  emergencyContacts: EmergencyContact[];

  // Rechtliches
  legalGuardian: LegalGuardian | null;
  hasAdvanceDirective: boolean;
  advanceDirectiveNotes: string;
  hasPowerOfAttorney: boolean;
  powerOfAttorneyNotes: string;
  hasDnrOrder: boolean;
  responsibleEmployees: ResponsibleEmployee[];
  responsibleEmployeeIds: number[];

  createdAt: string;
  updatedAt: string;
}

export function createEmptyPatient(): Patient {
  return {
    id: 0,
    patientNumber: '',
    status: 'active',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'diverse',
    email: '',
    phone: '',
    mobilePhone: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: '',
    insuranceType: '',
    insuranceProvider: '',
    insuranceNumber: '',
    careLevel: '',
    careLevelSince: '',
    diagnoses: [],
    allergies: [],
    medications: [],
    careNotes: '',
    livingSituation: '',
    mobility: '',
    nutrition: '',
    communicationAbility: '',
    treatingDoctors: [],
    emergencyContacts: [],
    legalGuardian: null,
    hasAdvanceDirective: false,
    advanceDirectiveNotes: '',
    hasPowerOfAttorney: false,
    powerOfAttorneyNotes: '',
    hasDnrOrder: false,
    responsibleEmployees: [],
    responsibleEmployeeIds: [],
    createdAt: '',
    updatedAt: '',
  };
}
