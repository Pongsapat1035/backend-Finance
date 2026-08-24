import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns the health response from AppService', () => {
    const appService = {
      getHello: jest.fn().mockReturnValue('Hello World!'),
    };
    const controller = new AppController(appService);

    expect(controller.getHello()).toBe('Hello World!');
    expect(appService.getHello).toHaveBeenCalledTimes(1);
  });
});
