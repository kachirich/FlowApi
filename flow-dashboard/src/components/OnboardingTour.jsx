import { useState, useEffect, useCallback } from 'react';
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import { getTourSteps } from './tourSteps';
import { API_BASE_URL } from '../utils/apiConfig';

const TOUR_STYLES = {
  options: {
    primaryColor: '#f59e0b',
    backgroundColor: '#18181b',
    textColor: '#f4f4f5',
    arrowColor: '#18181b',
    overlayColor: 'rgba(0,0,0,0.72)',
    zIndex: 10000,
  },
};

/**
 * Tier-aware product tour.
 *
 * Robustness: a per-step watchdog auto-advances on TARGET_NOT_FOUND so a
 * missing/unmounted anchor can never softlock the user — they can always
 * reach "Finish" even if a single step's element fails to mount.
 */
export default function OnboardingTour({ user, run, mandatory, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = getTourSteps(user?.plan_type);

  // Reset to the first step whenever a run is (re)started.
  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleCallback = useCallback(
    async (data) => {
      const { status, type, index, action } = data;

      // Auto-advance past a missing target instead of softlocking.
      if (type === EVENTS.TARGET_NOT_FOUND) {
        setStepIndex(index + 1);
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      }

      if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        // Persist completion. Cookie auth — credentials:'include', no Bearer header.
        try {
          await fetch(`${API_BASE_URL}/api/admin/onboarding/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          /* noop — local state still flips so the user isn't re-prompted this session */
        }
        onFinish?.();
      }
    },
    [onFinish]
  );

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton={!mandatory}
      disableOverlayClose={mandatory}
      disableCloseOnEsc={mandatory}
      spotlightClicks
      styles={TOUR_STYLES}
      locale={{ last: 'Finish Setup', skip: 'Skip tour' }}
      callback={handleCallback}
    />
  );
}
