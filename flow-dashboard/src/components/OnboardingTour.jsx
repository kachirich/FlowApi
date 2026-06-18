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
 * Universal product tour. No tier branching in step shape — only soft copy.
 * Beacons disabled globally to prevent idle dot clutter on the dashboard.
 */
export default function OnboardingTour({ run, mandatory, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = getTourSteps();

  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleCallback = useCallback(
    async (data) => {
      const { status, type, index, action } = data;

      if (type === EVENTS.TARGET_NOT_FOUND) {
        setStepIndex(index + 1);
        return;
      }
      if (type === EVENTS.STEP_AFTER) {
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      }
      if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        try {
          await fetch(`${API_BASE_URL}/api/admin/onboarding/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch { /* noop */ }
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
      disableBeacon
      floaterProps={{ disableAnimation: true }}
      styles={TOUR_STYLES}
      locale={{ last: 'Finish', skip: 'Skip tour' }}
      callback={handleCallback}
    />
  );
}
