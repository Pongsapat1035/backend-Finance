import { validateSync } from 'class-validator';
import {
  SpendingByCategoryQueryDto,
  SummaryQueryDto,
} from './summary-query.dto';

describe('SummaryQueryDto', () => {
  it('requires a valid month', () => {
    const query = new SummaryQueryDto();

    expect(validateSync(query)).not.toHaveLength(0);
    query.month = '2026-13';
    expect(validateSync(query)).not.toHaveLength(0);
    query.month = '2026-07';
    expect(validateSync(query)).toHaveLength(0);
  });
});

describe('SpendingByCategoryQueryDto', () => {
  it('allows the current month default or a valid explicit month', () => {
    const query = new SpendingByCategoryQueryDto();

    expect(validateSync(query)).toHaveLength(0);
    query.month = '2026-13';
    expect(validateSync(query)).not.toHaveLength(0);
    query.month = '2026-07';
    expect(validateSync(query)).toHaveLength(0);
  });
});
