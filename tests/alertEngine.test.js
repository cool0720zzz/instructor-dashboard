// Mock the db module before requiring alertEngine
jest.mock('../src/main/data/db', () => ({
  getLastWeekStatus: jest.fn(),
}));

const db = require('../src/main/data/db');
const { determineStatus } = require('../src/main/scheduler/alertEngine');

describe('alertEngine.determineStatus', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns "ok" when blogCount >= 1 AND reviewCount >= 1', () => {
    expect(determineStatus(1, 1, 1)).toBe('ok');
    expect(determineStatus(1, 3, 5)).toBe('ok');
    expect(determineStatus(1, 10, 1)).toBe('ok');
    // db.getLastWeekStatus should never be called in the ok path
    expect(db.getLastWeekStatus).not.toHaveBeenCalled();
  });

  test('returns "caution" when one count is 0 but not both', () => {
    expect(determineStatus(1, 0, 3)).toBe('caution');
    expect(determineStatus(1, 2, 0)).toBe('caution');
    expect(determineStatus(1, 0, 1)).toBe('caution');
    expect(determineStatus(1, 5, 0)).toBe('caution');
    expect(db.getLastWeekStatus).not.toHaveBeenCalled();
  });

  test('returns "warning" when both are 0 and last week was NOT warning', () => {
    // Last week status was 'ok'
    db.getLastWeekStatus.mockReturnValue({ status: 'ok' });
    expect(determineStatus(1, 0, 0)).toBe('warning');

    // Last week status was 'caution'
    db.getLastWeekStatus.mockReturnValue({ status: 'caution' });
    expect(determineStatus(2, 0, 0)).toBe('warning');

    // Last week status was 'danger'
    db.getLastWeekStatus.mockReturnValue({ status: 'danger' });
    expect(determineStatus(3, 0, 0)).toBe('warning');

    // No previous record at all
    db.getLastWeekStatus.mockReturnValue(null);
    expect(determineStatus(4, 0, 0)).toBe('warning');

    // undefined (no row)
    db.getLastWeekStatus.mockReturnValue(undefined);
    expect(determineStatus(5, 0, 0)).toBe('warning');
  });

  test('returns "danger" when both are 0 and last week WAS warning', () => {
    db.getLastWeekStatus.mockReturnValue({ status: 'warning' });
    expect(determineStatus(1, 0, 0)).toBe('danger');
    expect(db.getLastWeekStatus).toHaveBeenCalledWith(1);
  });
});
