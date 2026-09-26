import { AsyncLocalStorage } from "async_hooks";

export const tenantStorage = new AsyncLocalStorage();

export const getPharmacyId = () => {
  const store = tenantStorage.getStore();
  return store?.pharmacyId;
};

export const getPharmacyDbId = () => {
  const store = tenantStorage.getStore();
  return store?.pharmacyDbId;
};
