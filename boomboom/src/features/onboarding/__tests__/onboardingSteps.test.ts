import { getNextStep, ONBOARDING_STEPS } from '../onboardingSteps';

describe('onboarding steps', () => {
  it('walks through every step in order', () => {
    const visited = [ONBOARDING_STEPS[0]!];
    let next = getNextStep(visited[0]!);
    while (next) {
      visited.push(next);
      next = getNextStep(next);
    }
    expect(visited).toEqual(ONBOARDING_STEPS);
  });

  it('has no step after lifestyle', () => {
    expect(getNextStep('Lifestyle')).toBeNull();
  });
});
