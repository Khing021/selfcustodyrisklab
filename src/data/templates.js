export const templates = {
  template1: {
    label: "1. Simple Single Sig",
    state: {
      "locations": [
        {
          "id": "L-A",
          "label": "บ้าน",
          "storagePoints": [
            {
              "id": "S-A1",
              "label": "ห้องนอน - ตู้เซฟ",
              "isLocked": true
            },
            {
              "id": "S-A2",
              "label": "โต๊ะคอม - ลิ้นชัก",
              "isLocked": false
            }
          ]
        }
      ],
      "clouds": [],
      "seeds": [
        {
          "id": "Seed-A",
          "label": "Seed A",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [],
          "accounts": [
            {
              "id": "Acc-A1",
              "label": "Main Savings",
              "type": "single-sig",
              "passphraseId": null
            }
          ]
        }
      ],
      "spendingMethods": [
        {
          "id": "Method-1",
          "label": "Main Spending",
          "type": "single-sig",
          "threshold": 1,
          "keySlots": [
            "Acc-A1"
          ]
        }
      ],
      "objectMapping": {
        "obj-mnemonic-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A1"
        },
        "obj-hw-Acc-A1": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        },
        "obj-hw-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        }
      },
      "replication": {},
      "nextIds": {
        "location": 1,
        "cloud": 0,
        "seed": 1,
        "method": 1
      }
    }
  },
  template2: {
    label: "2. Single Sig + Passphrase",
    state: {
      "locations": [
        {
          "id": "L-A",
          "label": "บ้าน",
          "storagePoints": [
            {
              "id": "S-A1",
              "label": "ห้องนอน - ตู้เซฟ",
              "isLocked": true
            },
            {
              "id": "S-A2",
              "label": "โต๊ะคอม - ลิ้นชัก",
              "isLocked": false
            }
          ]
        },
        {
          "id": "L-User",
          "label": "พกติดตัว",
          "storagePoints": [
            {
              "id": "S-Pocket",
              "label": "กระเป๋าสตางค์",
              "isLocked": false
            }
          ]
        }
      ],
      "clouds": [],
      "seeds": [
        {
          "id": "Seed-A",
          "label": "Seed A",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [
            {
              "id": "P-1",
              "label": "Master Passphrase"
            }
          ],
          "accounts": [
            {
              "id": "Acc-A1",
              "label": "Main Savings",
              "type": "single-sig",
              "passphraseId": "P-1"
            }
          ]
        }
      ],
      "spendingMethods": [
        {
          "id": "Method-1",
          "label": "Main Spending",
          "type": "single-sig",
          "threshold": 1,
          "keySlots": [
            "Acc-A1"
          ]
        }
      ],
      "objectMapping": {
        "obj-mnemonic-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A1"
        },
        "obj-hw-Acc-A1": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        },
        "obj-pass-P-1": {
          "locationId": "memory",
          "storagePointId": "memory"
        },
        "obj-pass-P-1-copy-1": {
          "locationId": "L-User",
          "storagePointId": "S-Pocket"
        },
        "obj-hw-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        }
      },
      "replication": {
        "obj-pass-P-1": 1
      },
      "nextIds": {
        "location": 2,
        "cloud": 0,
        "seed": 1,
        "method": 1
      }
    }
  },
  template3: {
    label: "3. Multisig 2-of-3",
    state: {
      "locations": [
        {
          "id": "L-A",
          "label": "บ้าน",
          "storagePoints": [
            {
              "id": "S-A1",
              "label": "ห้องนอน - ตู้เซฟ",
              "isLocked": true
            },
            {
              "id": "S-A2",
              "label": "โต๊ะทำงาน - ลิ้นชัก",
              "isLocked": false
            }
          ]
        },
        {
          "id": "L-B",
          "label": "ที่ทำงาน",
          "storagePoints": [
            {
              "id": "S-B1",
              "label": "ตู้ล็อคเกอร์กุญแจ",
              "isLocked": true
            }
          ]
        },
        {
          "id": "L-C",
          "label": "บ้านพ่อแม่",
          "storagePoints": [
            {
              "id": "S-C1",
              "label": "หิ้งพระ",
              "isLocked": false
            }
          ]
        }
      ],
      "clouds": [],
      "seeds": [
        {
          "id": "Seed-A",
          "label": "Seed A",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [],
          "accounts": [
            {
              "id": "Acc-A",
              "label": "Cold Storage Key A",
              "type": "multi-sig",
              "passphraseId": null
            }
          ]
        },
        {
          "id": "Seed-B",
          "label": "Seed B",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [],
          "accounts": [
            {
              "id": "Acc-B",
              "label": "Cold Storage Key B",
              "type": "multi-sig",
              "passphraseId": null
            }
          ]
        },
        {
          "id": "Seed-C",
          "label": "Seed C",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [],
          "accounts": [
            {
              "id": "Acc-C",
              "label": "Cold Storage Key C",
              "type": "multi-sig",
              "passphraseId": null
            }
          ]
        }
      ],
      "spendingMethods": [
        {
          "id": "Method-1",
          "label": "Main Savings (2-of-3)",
          "type": "multi-sig",
          "threshold": 2,
          "keySlots": [
            "Acc-A",
            "Acc-B",
            "Acc-C"
          ]
        }
      ],
      "objectMapping": {
        "obj-mnemonic-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A1"
        },
        "obj-mnemonic-Seed-B": {
          "locationId": "L-B",
          "storagePointId": "S-B1"
        },
        "obj-mnemonic-Seed-C": {
          "locationId": "L-C",
          "storagePointId": "S-C1"
        },
        "obj-hw-Acc-A": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        },
        "obj-hw-Acc-B": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        },
        "obj-wallet-descriptor": {
          "locationId": "L-A",
          "storagePointId": "S-A1"
        },
        "obj-wallet-descriptor-copy-1": {
          "locationId": "L-B",
          "storagePointId": "S-B1"
        },
        "obj-wallet-descriptor-copy-2": {
          "locationId": "L-C",
          "storagePointId": "S-C1"
        },
        "obj-hw-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        },
        "obj-hw-Seed-B": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        }
      },
      "replication": {
        "obj-wallet-descriptor": 2
      },
      "nextIds": {
        "location": 3,
        "cloud": 0,
        "seed": 3,
        "method": 1
      }
    }
  },
  template4: {
    label: "4. Dual Spending Paths (Daily + Recovery)",
    state: {
      "locations": [
        {
          "id": "L-A",
          "label": "บ้าน",
          "storagePoints": [
            {
              "id": "S-A1",
              "label": "ตู้เซฟ",
              "isLocked": true
            },
            {
              "id": "S-A2",
              "label": "โต๊ะคอม - ลิ้นชัก",
              "isLocked": false
            }
          ]
        },
        {
          "id": "L-B",
          "label": "ที่ทำงาน",
          "storagePoints": [
            {
              "id": "S-B1",
              "label": "ลิ้นชักล็อกกุญแจ",
              "isLocked": true
            }
          ]
        }
      ],
      "clouds": [
        {
          "id": "Cloud-A",
          "label": "Bitwarden (คลาวด์เข้ารหัส)",
          "isLocked": true
        }
      ],
      "seeds": [
        {
          "id": "Seed-A",
          "label": "Key A",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [
            {
              "id": "P-1",
              "label": "Daily Passphrase"
            }
          ],
          "accounts": [
            {
              "id": "Acc-A-Daily",
              "label": "Daily Account (A+P)",
              "type": "single-sig",
              "passphraseId": "P-1"
            },
            {
              "id": "Acc-A-Raw",
              "label": "Recovery Key A",
              "type": "multi-sig",
              "passphraseId": null
            }
          ]
        },
        {
          "id": "Seed-B",
          "label": "Key B",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [],
          "accounts": [
            {
              "id": "Acc-B",
              "label": "Recovery Key B",
              "type": "multi-sig",
              "passphraseId": null
            }
          ]
        },
        {
          "id": "Seed-C",
          "label": "Key C",
          "type": "single",
          "threshold": 1,
          "shareCount": 1,
          "passphrases": [],
          "accounts": [
            {
              "id": "Acc-C",
              "label": "Recovery Key C",
              "type": "multi-sig",
              "passphraseId": null
            }
          ]
        }
      ],
      "spendingMethods": [
        {
          "id": "Method-1",
          "label": "Daily Spending (Single Sig)",
          "type": "single-sig",
          "threshold": 1,
          "keySlots": [
            "Acc-A-Daily"
          ]
        },
        {
          "id": "Method-2",
          "label": "Fund Recovery (Multisig 2-of-3)",
          "type": "multi-sig",
          "threshold": 2,
          "keySlots": [
            "Acc-A-Raw",
            "Acc-B",
            "Acc-C"
          ]
        }
      ],
      "objectMapping": {
        "obj-hw-Acc-A-Daily": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        },
        "obj-hw-Acc-A-Raw": {
          "locationId": "L-B",
          "storagePointId": "S-B1"
        },
        "obj-mnemonic-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A1"
        },
        "obj-mnemonic-Seed-B": {
          "locationId": "L-B",
          "storagePointId": "S-B1"
        },
        "obj-mnemonic-Seed-C": {
          "locationId": "Cloud-A",
          "storagePointId": "Cloud-A"
        },
        "obj-pass-P-1": {
          "locationId": "memory",
          "storagePointId": "memory"
        },
        "obj-pass-P-1-copy-1": {
          "locationId": "Cloud-A",
          "storagePointId": "Cloud-A"
        },
        "obj-wallet-descriptor": {
          "locationId": "Cloud-A",
          "storagePointId": "Cloud-A"
        },
        "obj-hw-Seed-A": {
          "locationId": "L-A",
          "storagePointId": "S-A2"
        }
      },
      "replication": {
        "obj-pass-P-1": 1
      },
      "nextIds": {
        "location": 2,
        "cloud": 1,
        "seed": 3,
        "method": 2
      }
    }
  }
};
