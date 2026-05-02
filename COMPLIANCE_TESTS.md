# Compliance Test Files

This directory contains sample JavaScript files designed to trigger different compliance flags in the Code Provenance system.

## Test Files Overview

| File | Compliance Flags | Risk Level | Keywords |
|------|-----------------|------------|----------|
| `test-hipaa.js` | **HIPAA** | Medium | patient, medical, health, phi |
| `test-gdpr.js` | **GDPR** | Medium | personal, privacy, consent, gdpr |
| `test-pci-dss.js` | **PCI-DSS** | High | payment, credit, card, billing |
| `test-sox.js` | **SOX** | Medium | sox, financial, audit |
| `test-credentials.js` | **Security** | **CRITICAL** | password, secret, key, token, auth |
| `test-multi-compliance.js` | **Multiple** | High | Combined triggers |

## How to Use

### 1. Open a Test File
Open any test file in VS Code:
```
test-hipaa.js      - Healthcare/patient data
test-pci-dss.js    - Payment processing
test-credentials.js - Secrets and authentication
```

### 2. Trigger AI Detection
Copy and paste code blocks **quickly** (under 1 second) to simulate AI code generation:

```javascript
// Select this entire function and paste it rapidly
function processPatientBilling(patientId, insuranceId, amount) {
  const patient = db.query(`SELECT * FROM patients WHERE id = '${patientId}'`);
  const coverage = checkInsuranceCoverage(insuranceId, patient.diagnosis);
  
  return {
    patient: patient.name,
    diagnosis: patient.medicalCondition,
    amount: amount,
    covered: coverage.approved
  };
}
```

### 3. Check Audit Trail

**Via VS Code:**
- Press `Ctrl+Shift+P` → "Code Provenance: Show Audit Trail"
- View the compliance flags and risk levels

**Via File:**
- Check `.vscode/provenance/audit-trail.json`

### 4. Expected Behavior

When you paste code quickly, you should see:

**Notification:**
```
AI code detected: test-hipaa.js (lines 15-28) - 75% confidence
```

**Audit Trail Entry:**
```json
{
  "file": "test-hipaa.js",
  "compliance": {
    "flags": ["HIPAA"],
    "risk_level": "medium",
    "human_review_required": false
  }
}
```

**Embedded in Source File:**
```javascript
// AI-GENERATED-CODE: prov: eyJpZCI6InByb3YtMTc3Nzc1MDU5MDM1OS02NTlmNmIyZmRhZjdmOTU4I...
function processPatientBilling(patientId, insuranceId, amount) {
```

## Risk Level Mapping

| Risk Level | Triggers | Human Review Required |
|------------|----------|----------------------|
| **CRITICAL** | password, secret, private.*key, api.*key | Yes |
| **HIGH** | auth, login, payment, encrypt | Yes |
| **MEDIUM** | database, sql, query, api, patient, medical | No |
| **LOW** | Other code patterns | No |

## Compliance Flag Details

### HIPAA (Healthcare)
**Keywords:** patient, medical, health, phi
**Example:**
```javascript
function getPatientRecord(patientId) {
  return db.query(`SELECT * FROM patients WHERE id = '${patientId}'`);
}
```

### GDPR (Privacy)
**Keywords:** personal, privacy, consent, gdpr
**Example:**
```javascript
function handleDataDeletionRequest(userId) {
  db.query(`DELETE FROM users WHERE id = '${userId}'`);
  return { success: true };
}
```

### PCI-DSS (Payments)
**Keywords:** payment, credit, card, billing
**Example:**
```javascript
function processPayment(cardData, amount) {
  return chargeCard({
    cardNumber: cardData.number,
    cvv: cardData.cvv
  });
}
```

### SOX (Financial)
**Keywords:** sox, financial, audit
**Example:**
```javascript
function recordFinancialTransaction(txn) {
  return appendToLedger({
    amount: txn.amount,
    accountCode: txn.glAccount
  });
}
```

## Tips for Testing

1. **Type/paste quickly** - The detector looks for sub-1-second insertions
2. **Use block insertions** - Paste multi-line functions, not single words
3. **Check output panel** - View "Code Provenance" channel for logs
4. **Try different files** - Each triggers different compliance flags
5. **Extract provenance** - Use "Code Provenance: Extract Embedded Provenance from File" command

## Expected Audit Trail Output

After testing all files, your audit trail should contain entries similar to:

```json
[
  {
    "file": "test-hipaa.js",
    "compliance": {
      "flags": ["HIPAA"],
      "risk_level": "medium"
    }
  },
  {
    "file": "test-pci-dss.js", 
    "compliance": {
      "flags": ["PCI-DSS"],
      "risk_level": "high"
    }
  },
  {
    "file": "test-credentials.js",
    "compliance": {
      "flags": [],
      "risk_level": "critical"
    }
  }
]
```
