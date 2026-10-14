# Pierwsze wydanie tylko na macOS

Izolację (ADR 0004) trzeba zaprojektować i przetestować osobno na każdym systemie, więc zaczynamy od jednego: macOS. Windows i Linux pojawią się dopiero po ustabilizowaniu modelu uprawnień i sandboxa na Macu. Za macOS przemawia też iOS Simulator, który istnieje tylko tam.

## Konsekwencje

- Kod zależny od systemu (sandbox, keychain, tray, usługa w tle) siedzi za interfejsami, żeby późniejsze porty nie wymagały przebudowy rdzenia.
