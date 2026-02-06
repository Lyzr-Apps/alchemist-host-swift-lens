'use client'

/**
 * THE ALCHEMIST HOST - Chat-First Cocktail Planning Application
 *
 * A sophisticated AI-powered bar host that helps plan cocktail events
 * with adaptive conversation, plan generation, and shopping cart functionality.
 */

import { useState, useRef, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  FaGlassMartiniAlt,
  FaUserCheck,
  FaTimes,
  FaPaperPlane,
  FaInfoCircle,
  FaChevronDown,
  FaChevronUp,
  FaShoppingCart,
  FaEdit,
  FaCheck,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaUsers,
  FaClock,
  FaHeart,
  FaWineGlass,
  FaLemon,
  FaIceCube,
  FaLeaf
} from 'react-icons/fa'

// ============================================================================
// TYPESCRIPT INTERFACES (from test_responses)
// ============================================================================

interface CollectedSlots {
  event_type: string | null
  guest_count: number | null
  duration_hours: number | null
  occasion: string | null
  preferences: string | null
}

interface PlanCard {
  id: string
  title: string
  description: string
  cocktails: string[]
  estimated_cost: number
  drink_count: number
  recipes?: Recipe[]
}

interface Recipe {
  name: string
  ingredients: { item: string; amount: string }[]
  instructions: string[]
  glassware: string
  garnish: string
}

interface CartItem {
  category: string
  item: string
  quantity: string
  price: number
}

interface HostOrchestratorResult {
  conversation_state: 'slot_filling' | 'planning' | 'presenting_options' | 'cart_ready'
  collected_slots: CollectedSlots
  next_question: string
  quick_replies: string[]
  plan_cards: PlanCard[]
  current_action: string
  cart_items?: CartItem[]
  cart_total?: number
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  quick_replies?: string[]
  plan_cards?: PlanCard[]
  cart_items?: CartItem[]
  cart_total?: number
  is_safety_warning?: boolean
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const HOST_ORCHESTRATOR_ID = '698595caab4bf65a66ad08a4'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // State Management
  const [ageVerified, setAgeVerified] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingContext, setTypingContext] = useState('Processing...')
  const [eventDetails, setEventDetails] = useState<CollectedSlots>({
    event_type: null,
    guest_count: null,
    duration_hours: null,
    occasion: null,
    preferences: null
  })
  const [selectedPlan, setSelectedPlan] = useState<PlanCard | null>(null)
  const [sessionId] = useState(() => `session_${Date.now()}`)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize chat after age verification
  useEffect(() => {
    if (ageVerified && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: "Great! I'm your Alchemist Host. Tell me about your event, and I'll help you create the perfect cocktail experience.",
        timestamp: new Date(),
        quick_replies: [
          'Birthday Party',
          'Wedding',
          'Corporate Event',
          'Casual Gathering'
        ]
      }
      setMessages([welcomeMessage])
    }
  }, [ageVerified, messages.length])

  // ============================================================================
  // HANDLER FUNCTIONS
  // ============================================================================

  const handleAgeVerification = (verified: boolean) => {
    if (verified) {
      setAgeVerified(true)
    } else {
      // In production, redirect away or show exit message
      alert('You must be of legal drinking age to use this service.')
    }
  }

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim()
    if (!textToSend) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')

    // Show typing indicator
    setIsTyping(true)
    setTypingContext('Understanding your request...')

    try {
      // Call Host Orchestrator
      const result = await callAIAgent(textToSend, HOST_ORCHESTRATOR_ID, { session_id: sessionId })

      if (result.success && result.response.status === 'success') {
        const data = result.response.result as HostOrchestratorResult

        // Update event details
        if (data.collected_slots) {
          setEventDetails(data.collected_slots)
        }

        // Determine typing context based on state
        if (data.conversation_state === 'planning') {
          setTypingContext('Crafting your perfect menu...')
        } else if (data.conversation_state === 'presenting_options') {
          setTypingContext('Preparing your cocktail plans...')
        }

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: data.next_question || data.current_action || 'How else can I help?',
          timestamp: new Date(),
          quick_replies: data.quick_replies?.length > 0 ? data.quick_replies : undefined,
          plan_cards: data.plan_cards?.length > 0 ? data.plan_cards : undefined,
          cart_items: data.cart_items,
          cart_total: data.cart_total
        }

        setMessages(prev => [...prev, assistantMessage])
      } else {
        // Error response
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: 'I apologize, but I encountered an issue. Could you please try rephrasing your request?',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: 'I apologize for the technical difficulty. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleQuickReply = (reply: string) => {
    handleSendMessage(reply)
  }

  const handleSelectPlan = (plan: PlanCard) => {
    setSelectedPlan(plan)
    handleSendMessage(`I'd like to select the "${plan.title}" plan`)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ============================================================================
  // RENDER: Age Verification Modal
  // ============================================================================

  if (!ageVerified) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-800 border-amber-500/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <FaGlassMartiniAlt className="text-6xl text-amber-500" />
            </div>
            <CardTitle className="text-3xl text-amber-500 mb-2">
              The Alchemist Host
            </CardTitle>
            <CardDescription className="text-gray-300 text-base">
              Welcome to your personal cocktail concierge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-700/50 p-4 rounded-lg border border-amber-500/20">
              <p className="text-gray-200 text-center leading-relaxed">
                To continue, please confirm you are of legal drinking age in your jurisdiction.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => handleAgeVerification(true)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-6 text-lg"
              >
                <FaUserCheck className="mr-2" />
                I am of legal drinking age
              </Button>

              <Button
                onClick={() => handleAgeVerification(false)}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 py-6 text-lg"
              >
                <FaTimes className="mr-2" />
                Exit
              </Button>
            </div>

            <div className="text-center text-xs text-gray-500 pt-2">
              <FaInfoCircle className="inline mr-1" />
              Please drink responsibly
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // RENDER: Main Chat Interface
  // ============================================================================

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header Bar */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-amber-500/20 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <FaGlassMartiniAlt className="text-3xl text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-amber-500">The Alchemist Host</h1>
            <p className="text-xs text-gray-400">Your Cocktail Concierge</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-amber-500"
            onClick={() => window.open('https://www.responsibility.org/', '_blank')}
          >
            <FaInfoCircle className="text-lg" />
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              >
                <FaEdit className="mr-2" />
                Event Details
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-gray-800 border-l border-amber-500/20">
              <EventDetailsDrawer eventDetails={eventDetails} setEventDetails={setEventDetails} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Chat Messages Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === 'user' ? (
              <UserMessage message={message} />
            ) : (
              <AssistantMessage
                message={message}
                onQuickReply={handleQuickReply}
                onSelectPlan={handleSelectPlan}
              />
            )}
          </div>
        ))}

        {isTyping && <TypingIndicator context={typingContext} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="bg-gray-800/80 backdrop-blur-sm border-t border-amber-500/20 px-4 py-4">
        <div className="max-w-4xl mx-auto flex space-x-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-amber-500"
            disabled={isTyping}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900 px-6"
          >
            <FaPaperPlane />
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-2">
          <FaExclamationTriangle className="inline mr-1" />
          Always drink responsibly. Never drink and drive.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// User Message Component
function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%] bg-gray-600 rounded-lg px-4 py-3 shadow-md">
        <p className="text-white">{message.content}</p>
        <p className="text-xs text-gray-400 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// Assistant Message Component
function AssistantMessage({
  message,
  onQuickReply,
  onSelectPlan
}: {
  message: ChatMessage
  onQuickReply: (reply: string) => void
  onSelectPlan: (plan: PlanCard) => void
}) {
  return (
    <div className="flex justify-start">
      <div className="flex space-x-3 max-w-[85%]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
            <FaGlassMartiniAlt className="text-gray-900 text-lg" />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="bg-gray-700 rounded-lg px-4 py-3 shadow-md border border-amber-500/10">
            <p className="text-gray-100">{message.content}</p>
            <p className="text-xs text-gray-500 mt-1">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Quick Reply Chips */}
          {message.quick_replies && message.quick_replies.length > 0 && (
            <QuickReplyChips options={message.quick_replies} onSelect={onQuickReply} />
          )}

          {/* Plan Cards */}
          {message.plan_cards && message.plan_cards.length > 0 && (
            <div className="space-y-3">
              {message.plan_cards.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onSelect={onSelectPlan} />
              ))}
            </div>
          )}

          {/* Cart Summary */}
          {message.cart_items && message.cart_items.length > 0 && (
            <CartSummary items={message.cart_items} total={message.cart_total || 0} />
          )}
        </div>
      </div>
    </div>
  )
}

// Quick Reply Chips Component
function QuickReplyChips({ options, onSelect }: { options: string[]; onSelect: (option: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, index) => (
        <Button
          key={index}
          onClick={() => onSelect(option)}
          variant="outline"
          size="sm"
          className="border-amber-500/50 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500 transition-all duration-200"
        >
          {option}
        </Button>
      ))}
    </div>
  )
}

// Plan Card Component
function PlanCard({ plan, onSelect }: { plan: PlanCard; onSelect: (plan: PlanCard) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-amber-500/30 shadow-xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-amber-500 text-xl flex items-center">
              <FaWineGlass className="mr-2" />
              {plan.title}
            </CardTitle>
            <CardDescription className="text-gray-300 mt-2">
              {plan.description}
            </CardDescription>
          </div>
          <Badge className="bg-amber-500 text-gray-900 font-bold">
            ${plan.estimated_cost}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            <FaGlassMartiniAlt className="inline mr-2" />
            {plan.drink_count} cocktails
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-gray-300 font-medium">Cocktail Selection:</p>
          <ul className="space-y-1">
            {plan.cocktails.slice(0, expanded ? undefined : 3).map((cocktail, index) => (
              <li key={index} className="text-gray-400 text-sm flex items-center">
                <FaCheck className="text-amber-500 mr-2 text-xs" />
                {cocktail}
              </li>
            ))}
          </ul>
          {plan.cocktails.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-amber-500 hover:text-amber-400 p-0 h-auto"
            >
              {expanded ? (
                <>
                  <FaChevronUp className="mr-1" /> Show Less
                </>
              ) : (
                <>
                  <FaChevronDown className="mr-1" /> Show {plan.cocktails.length - 3} More
                </>
              )}
            </Button>
          )}
        </div>

        {/* Expanded Recipe Details */}
        {expanded && plan.recipes && plan.recipes.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-gray-600">
            {plan.recipes.map((recipe, index) => (
              <RecipeCard key={index} recipe={recipe} />
            ))}
          </div>
        )}

        <div className="flex space-x-2 pt-2">
          <Button
            onClick={() => setExpanded(!expanded)}
            variant="outline"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            {expanded ? 'Hide Details' : 'View Details'}
          </Button>
          <Button
            onClick={() => onSelect(plan)}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold"
          >
            <FaShoppingCart className="mr-2" />
            Select Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Recipe Card Component
function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
      <h4 className="text-amber-500 font-semibold mb-3 flex items-center">
        <FaGlassMartiniAlt className="mr-2" />
        {recipe.name}
      </h4>

      <div className="space-y-3">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-2 flex items-center">
            <FaLemon className="mr-2" />
            Ingredients:
          </p>
          <ul className="space-y-1">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="text-gray-300 text-sm ml-6">
                • {ingredient.amount} {ingredient.item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-gray-400 text-sm font-medium mb-2">Instructions:</p>
          <ol className="space-y-1">
            {recipe.instructions.map((instruction, index) => (
              <li key={index} className="text-gray-300 text-sm ml-6">
                {index + 1}. {instruction}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center space-x-4 text-sm pt-2 border-t border-gray-700">
          <span className="text-gray-400 flex items-center">
            <FaWineGlass className="mr-2 text-amber-500" />
            {recipe.glassware}
          </span>
          <span className="text-gray-400 flex items-center">
            <FaLeaf className="mr-2 text-amber-500" />
            {recipe.garnish}
          </span>
        </div>
      </div>
    </div>
  )
}

// Cart Summary Component
function CartSummary({ items, total }: { items: CartItem[]; total: number }) {
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, CartItem[]>)

  return (
    <Card className="bg-gray-700 border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-amber-500 flex items-center">
          <FaShoppingCart className="mr-2" />
          Shopping List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            <h4 className="text-gray-300 font-semibold mb-2 capitalize">{category}</h4>
            <ul className="space-y-2">
              {categoryItems.map((item, index) => (
                <li key={index} className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    {item.quantity} {item.item}
                  </span>
                  <span className="text-amber-500 font-medium">${item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {category !== Object.keys(groupedItems)[Object.keys(groupedItems).length - 1] && (
              <Separator className="mt-3 bg-gray-600" />
            )}
          </div>
        ))}

        <Separator className="bg-amber-500/30" />

        <div className="flex justify-between items-center pt-2">
          <span className="text-gray-300 font-bold text-lg">Total</span>
          <span className="text-amber-500 font-bold text-2xl">${total.toFixed(2)}</span>
        </div>

        <Button className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-6 text-lg">
          <FaCheck className="mr-2" />
          Confirm Order
        </Button>

        <p className="text-xs text-gray-500 text-center">
          <FaExclamationTriangle className="inline mr-1" />
          Please drink responsibly
        </p>
      </CardContent>
    </Card>
  )
}

// Typing Indicator Component
function TypingIndicator({ context }: { context: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
            <FaGlassMartiniAlt className="text-gray-900 text-lg" />
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg px-4 py-3 shadow-md border border-amber-500/10">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-gray-400 text-sm ml-2">{context}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Event Details Drawer Component
function EventDetailsDrawer({
  eventDetails,
  setEventDetails
}: {
  eventDetails: CollectedSlots
  setEventDetails: (details: CollectedSlots) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [editedDetails, setEditedDetails] = useState(eventDetails)

  const handleApplyChanges = () => {
    setEventDetails(editedDetails)
    setEditMode(false)
  }

  useEffect(() => {
    setEditedDetails(eventDetails)
  }, [eventDetails])

  return (
    <SheetHeader>
      <SheetTitle className="text-amber-500 text-2xl mb-6">Event Details</SheetTitle>

      <div className="space-y-6 pt-4">
        <div className="space-y-4">
          <DetailItem
            icon={<FaCalendarAlt />}
            label="Event Type"
            value={editedDetails.event_type}
            editMode={editMode}
            onChange={(value) => setEditedDetails({ ...editedDetails, event_type: value })}
          />

          <DetailItem
            icon={<FaUsers />}
            label="Guest Count"
            value={editedDetails.guest_count?.toString()}
            editMode={editMode}
            onChange={(value) => setEditedDetails({ ...editedDetails, guest_count: parseInt(value) || null })}
            type="number"
          />

          <DetailItem
            icon={<FaClock />}
            label="Duration (hours)"
            value={editedDetails.duration_hours?.toString()}
            editMode={editMode}
            onChange={(value) => setEditedDetails({ ...editedDetails, duration_hours: parseInt(value) || null })}
            type="number"
          />

          <DetailItem
            icon={<FaHeart />}
            label="Occasion"
            value={editedDetails.occasion}
            editMode={editMode}
            onChange={(value) => setEditedDetails({ ...editedDetails, occasion: value })}
          />

          <DetailItem
            icon={<FaGlassMartiniAlt />}
            label="Preferences"
            value={editedDetails.preferences}
            editMode={editMode}
            onChange={(value) => setEditedDetails({ ...editedDetails, preferences: value })}
          />
        </div>

        <div className="space-y-2 pt-4">
          {editMode ? (
            <>
              <Button
                onClick={handleApplyChanges}
                className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold"
              >
                <FaCheck className="mr-2" />
                Apply Changes
              </Button>
              <Button
                onClick={() => {
                  setEditedDetails(eventDetails)
                  setEditMode(false)
                }}
                variant="outline"
                className="w-full border-gray-600 text-gray-300"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setEditMode(true)}
              variant="outline"
              className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
            >
              <FaEdit className="mr-2" />
              Edit Details
            </Button>
          )}
        </div>
      </div>
    </SheetHeader>
  )
}

// Detail Item Component (for Event Details Drawer)
function DetailItem({
  icon,
  label,
  value,
  editMode,
  onChange,
  type = 'text'
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  editMode: boolean
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-amber-500">{icon}</span>
        <span className="text-gray-400 text-sm font-medium">{label}</span>
      </div>
      {editMode ? (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          className="bg-gray-800 border-gray-600 text-white"
        />
      ) : (
        <p className="text-white ml-6">
          {value || <span className="text-gray-500 italic">Not set</span>}
        </p>
      )}
    </div>
  )
}
