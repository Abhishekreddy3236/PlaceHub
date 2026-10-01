export const MAINTENANCE_EVENT_NAME = 'placehub:maintenance-mode';

let isMaintenanceActive = false;

export const triggerMaintenanceMode = () => {
  if (!isMaintenanceActive) {
    isMaintenanceActive = true;
    window.dispatchEvent(new Event(MAINTENANCE_EVENT_NAME));
  }
};

export const resetMaintenanceMode = () => {
  isMaintenanceActive = false;
};

export const getMaintenanceStatus = () => isMaintenanceActive;
