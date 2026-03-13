/**
 * UUID Mock for Testing
 */

export const v4 = jest.fn(() => 'mock-uuid-1234-5678-9012');
export const v1 = jest.fn(() => 'mock-uuid-v1-1234-5678');
export const v5 = jest.fn(() => 'mock-uuid-v5-1234-5678');
export const v3 = jest.fn(() => 'mock-uuid-v3-1234-5678');
export const validate = jest.fn(() => true);
export const version = jest.fn(() => 4);
export const NIL = '00000000-0000-0000-0000-000000000000';
export const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export default { v4, v1, v3, v5, validate, version, NIL, MAX };
