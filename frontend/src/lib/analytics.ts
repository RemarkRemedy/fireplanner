// Type declaration for Umami's global
declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, string | number | boolean>) => void
    }
  }
}

// Event name union type for type-safety
type AnalyticsEvent =
  | 'onboarding_pathway_selected'
  | 'onboarding_continue'
  | 'simulation_run'
  | 'simulation_completed'
  | 'simulation_failed'
  | 'feature_toggle'
  | 'data_exported'
  | 'data_imported'
  | 'plan_shared'
  | 'scenario_saved'
  | 'scenario_loaded'
  | 'strategy_selected'
  | 'strategy_guide_opened'
  | 'mode_changed'
  | 'salary_model_changed'
  | 'goal_added'
  | 'allocation_template_applied'
  | 'stress_test_tab_changed'
  | 'dollar_basis_changed'
  | 'checklist_item_toggled'
  | 'section_reset'
  | 'email_signup_shown'
  | 'email_signup_submitted'
  | 'email_signup_success'
  | 'email_signup_error'
  | 'feature_interest_selected'
  | 'telegram_join_clicked'
  | 'life_event_added'
  | 'life_event_removed'
  | 'withdrawal_basis_changed'
  | 'section_mode_changed'
  | 'scenario_deleted'
  | 'checklist_reset'
  | 'page_navigated'
  | 'session_start'
  | 'cpf_estimated_from_age'

export function trackEvent(event: AnalyticsEvent, data?: Record<string, string | number | boolean>) {
  window.umami?.track(event, data)
}
