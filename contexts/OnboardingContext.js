import React, { createContext, useContext, useState, useMemo } from 'react';

// Holds the four answers for the duration of the onboarding flow so the user
// can move back and forth between screens without losing picks, and the
// summary always reflects the latest choices. Saved to the profile in one
// update on the summary screen.
const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [levelEstimate, setLevelEstimate] = useState(null);
  const [goal, setGoal] = useState(null);
  const [goalDate, setGoalDate] = useState(null); // 'YYYY-MM-DD' string or null
  const [dailyMinutes, setDailyMinutes] = useState(null);

  const value = useMemo(() => ({
    levelEstimate, setLevelEstimate,
    goal, setGoal,
    goalDate, setGoalDate,
    dailyMinutes, setDailyMinutes,
  }), [levelEstimate, goal, goalDate, dailyMinutes]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
