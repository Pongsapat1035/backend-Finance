import { PATH_METADATA } from '@nestjs/common/constants';
import { SummaryController } from './summary.controller';

describe('SummaryController', () => {
  const summaryService = {
    getSummary: jest.fn(),
    getExpensesByCategory: jest.fn(),
    getNetCashFlow: jest.fn(),
  };
  const controller = new SummaryController(summaryService as never);

  it('exposes the transaction summary at /summary/transaction', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SummaryController)).toBe(
      'summary',
    );
    const method = Object.getOwnPropertyDescriptor(
      SummaryController.prototype,
      'getSummary',
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe('transaction');
  });

  it('returns the authenticated user summary', () => {
    summaryService.getSummary.mockReturnValue({ net: 1000 });

    expect(controller.getSummary(10, { month: '2026-07' })).toEqual({
      net: 1000,
    });
    expect(summaryService.getSummary).toHaveBeenCalledWith(10, {
      month: '2026-07',
    });
  });

  it('passes the authenticated user and month to the category breakdown', () => {
    summaryService.getExpensesByCategory.mockReturnValue({
      totalExpenses: 760,
    });

    expect(controller.getExpensesByCategory(10, {})).toEqual({
      totalExpenses: 760,
    });
    expect(summaryService.getExpensesByCategory).toHaveBeenCalledWith(10, {});
  });

  it('serves monthly and yearly cash flow from one /summary/net-cash-flow route', () => {
    const routes = Object.getOwnPropertyNames(SummaryController.prototype)
      .map((name) => {
        const handler = Object.getOwnPropertyDescriptor(
          SummaryController.prototype,
          name,
        )?.value as object;
        return Reflect.getMetadata(PATH_METADATA, handler) as
          string | undefined;
      })
      .filter((path) => path?.startsWith('net-cash-flow'));

    expect(routes).toEqual(['net-cash-flow']);
  });

  it('passes the authenticated user and query to the net cash flow', async () => {
    summaryService.getNetCashFlow.mockResolvedValue({ period: '2026' });

    await expect(
      controller.getNetCashFlow(10, { type: 'yearly', year: 2026 }),
    ).resolves.toEqual({ period: '2026' });
    expect(summaryService.getNetCashFlow).toHaveBeenCalledWith(10, {
      type: 'yearly',
      year: 2026,
    });
  });
});
