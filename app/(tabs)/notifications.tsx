// The notifications tab renders normally inside the tab navigator.
// Keeping it mounted by the navigator avoids pushing a second route with the
// same visible screen, which could make Fabric attach one native view twice.
export { default } from '../notifications/index';
