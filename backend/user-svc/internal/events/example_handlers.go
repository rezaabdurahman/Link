package events

import (
	"context"
	"encoding/json"
	"log"
)

// ExampleAnalyticsHandler demonstrates how an analytics service could listen to onboarding events
func ExampleAnalyticsHandler(ctx context.Context, event Event) error {
	switch event.GetEventType() {
	case UserOnboardingStartedEventType:
		return handleOnboardingStarted(ctx, event)
	case UserOnboardingProgressedEventType:
		return handleOnboardingProgressed(ctx, event)
	case UserOnboardedEventType:
		return handleUserOnboarded(ctx, event)
	case UserOnboardingSkippedEventType:
		return handleOnboardingSkipped(ctx, event)
	default:
		log.Printf("Unknown event type: %s", event.GetEventType())
		return nil
	}
}

// handleOnboardingStarted processes user onboarding started events
func handleOnboardingStarted(ctx context.Context, event Event) error {
	var data UserOnboardingStartedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	// Example analytics operations:
	log.Printf("📊 Analytics: User %s started onboarding at %s", 
		data.UserID, data.StartedAt.Format("2006-01-02 15:04:05"))
	
	// In a real implementation, you might:
	// - Record the start time in analytics database
	// - Trigger A/B testing assignment
	// - Send data to external analytics platform
	// - Start user journey tracking
	
	return nil
}

// handleOnboardingProgressed processes user onboarding progressed events
func handleOnboardingProgressed(ctx context.Context, event Event) error {
	var data UserOnboardingProgressedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("📈 Analytics: User %s completed step '%s' at %s", 
		data.UserID, data.CompletedStep, data.ProgressedAt.Format("2006-01-02 15:04:05"))
	
	// In a real implementation, you might:
	// - Track step completion rates
	// - Measure time spent on each step
	// - Identify drop-off points
	// - Update user journey progress
	// - Trigger step-specific notifications
	
	return nil
}

// handleUserOnboarded processes user onboarded events
func handleUserOnboarded(ctx context.Context, event Event) error {
	var data UserOnboardedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("🎉 Analytics: User %s completed onboarding! Duration: %s, Steps: %d", 
		data.UserID, data.Duration, len(data.CompletedSteps))
	
	// In a real implementation, you might:
	// - Record successful onboarding completion
	// - Calculate completion rates and statistics
	// - Send congratulations email/notification
	// - Update user segment for marketing
	// - Trigger welcome sequence
	// - Update user status in CRM
	
	return nil
}

// handleOnboardingSkipped processes user onboarding skipped events
func handleOnboardingSkipped(ctx context.Context, event Event) error {
	var data UserOnboardingSkippedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("⏭️  Analytics: User %s skipped onboarding at %s (completed %d partial steps)", 
		data.UserID, data.SkippedAt.Format("2006-01-02 15:04:05"), len(data.PartialSteps))
	
	// In a real implementation, you might:
	// - Track skip rates and patterns
	// - Identify why users skip onboarding
	// - Send targeted re-engagement campaigns
	// - Update user segment for partial completers
	// - Schedule follow-up onboarding reminders
	
	return nil
}

// ExampleNotificationHandler demonstrates how a notification service could listen to onboarding events
func ExampleNotificationHandler(ctx context.Context, event Event) error {
	switch event.GetEventType() {
	case UserOnboardedEventType:
		return sendWelcomeNotification(ctx, event)
	case UserOnboardingSkippedEventType:
		return scheduleReEngagementNotification(ctx, event)
	default:
		// Not interested in other onboarding events
		return nil
	}
}

// sendWelcomeNotification sends a welcome notification when onboarding completes
func sendWelcomeNotification(ctx context.Context, event Event) error {
	var data UserOnboardedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("📧 Notification: Sending welcome message to user %s", data.UserID)
	
	// In a real implementation, you might:
	// - Send welcome email
	// - Send push notification
	// - Create in-app notification
	// - Schedule onboarding follow-up sequence
	
	return nil
}

// scheduleReEngagementNotification schedules re-engagement when user skips onboarding
func scheduleReEngagementNotification(ctx context.Context, event Event) error {
	var data UserOnboardingSkippedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("⏰ Notification: Scheduling re-engagement sequence for user %s", data.UserID)
	
	// In a real implementation, you might:
	// - Schedule reminder emails
	// - Create targeted push notifications
	// - Add user to re-engagement campaign
	// - Set up drip campaign for incomplete onboarding
	
	return nil
}

// ExampleCRMHandler demonstrates how a CRM service could listen to onboarding events
func ExampleCRMHandler(ctx context.Context, event Event) error {
	switch event.GetEventType() {
	case UserOnboardingStartedEventType:
		return updateCRMOnboardingStarted(ctx, event)
	case UserOnboardedEventType:
		return updateCRMOnboardingCompleted(ctx, event)
	case UserOnboardingSkippedEventType:
		return updateCRMOnboardingSkipped(ctx, event)
	default:
		return nil
	}
}

// updateCRMOnboardingStarted updates CRM when user starts onboarding
func updateCRMOnboardingStarted(ctx context.Context, event Event) error {
	var data UserOnboardingStartedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("🏢 CRM: User %s started onboarding - updating lead status", data.UserID)
	
	// In a real implementation, you might:
	// - Update lead status in CRM
	// - Assign to sales representative
	// - Create onboarding activity record
	// - Set up follow-up tasks
	
	return nil
}

// updateCRMOnboardingCompleted updates CRM when user completes onboarding
func updateCRMOnboardingCompleted(ctx context.Context, event Event) error {
	var data UserOnboardedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("✅ CRM: User %s completed onboarding - converting to active customer", data.UserID)
	
	// In a real implementation, you might:
	// - Convert lead to customer in CRM
	// - Update user lifecycle stage
	// - Trigger account setup processes
	// - Assign customer success manager
	
	return nil
}

// updateCRMOnboardingSkipped updates CRM when user skips onboarding
func updateCRMOnboardingSkipped(ctx context.Context, event Event) error {
	var data UserOnboardingSkippedEventData
	if err := mapEventData(event.GetData(), &data); err != nil {
		return err
	}

	log.Printf("⚠️  CRM: User %s skipped onboarding - marking for follow-up", data.UserID)
	
	// In a real implementation, you might:
	// - Mark lead as requiring follow-up
	// - Create task for sales team
	// - Set up nurture campaign
	// - Update lead scoring based on skip behavior
	
	return nil
}

// RegisterExampleHandlers demonstrates how to register event handlers
func RegisterExampleHandlers(eventBus EventBus) error {
	// Register analytics handler for all onboarding events
	if err := eventBus.Subscribe(UserOnboardingStartedEventType, ExampleAnalyticsHandler); err != nil {
		return err
	}
	if err := eventBus.Subscribe(UserOnboardingProgressedEventType, ExampleAnalyticsHandler); err != nil {
		return err
	}
	if err := eventBus.Subscribe(UserOnboardedEventType, ExampleAnalyticsHandler); err != nil {
		return err
	}
	if err := eventBus.Subscribe(UserOnboardingSkippedEventType, ExampleAnalyticsHandler); err != nil {
		return err
	}

	// Register notification handler for specific events
	if err := eventBus.Subscribe(UserOnboardedEventType, ExampleNotificationHandler); err != nil {
		return err
	}
	if err := eventBus.Subscribe(UserOnboardingSkippedEventType, ExampleNotificationHandler); err != nil {
		return err
	}

	// Register CRM handler for relevant events
	if err := eventBus.Subscribe(UserOnboardingStartedEventType, ExampleCRMHandler); err != nil {
		return err
	}
	if err := eventBus.Subscribe(UserOnboardedEventType, ExampleCRMHandler); err != nil {
		return err
	}
	if err := eventBus.Subscribe(UserOnboardingSkippedEventType, ExampleCRMHandler); err != nil {
		return err
	}

	log.Println("✅ Example event handlers registered successfully")
	return nil
}

// mapEventData is a helper function to map event data to specific types
func mapEventData(eventData interface{}, target interface{}) error {
	// Convert to JSON and back to properly map the data
	jsonData, err := json.Marshal(eventData)
	if err != nil {
		return err
	}
	
	return json.Unmarshal(jsonData, target)
}
