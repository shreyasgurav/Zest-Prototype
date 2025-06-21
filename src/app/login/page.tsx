"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { 
  onAuthStateChanged, 
  User, 
  signOut, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from "firebase/auth"
import { auth, db } from "../../lib/firebase"
import { ArrowLeft } from "lucide-react"
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "react-toastify"
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { handleAuthenticationFlow } from '../../utils/authHelpers'
import { isOrganizationSession } from '../../utils/authHelpers'
import styles from "./login.module.css"

// Extend Window interface for reCAPTCHA
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | null;
    confirmationResult: ConfirmationResult | null;
  }
}

interface FormData {
  name: string;
  username: string;
  contactEmail: string;
}

export default function LoginPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showPostLoginForm, setShowPostLoginForm] = useState(false)
  const [formData, setFormData] = useState<FormData>({ name: "", username: "", contactEmail: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [isClient, setIsClient] = useState(false)

  // Phone/OTP login states
  const [currentStep, setCurrentStep] = useState<'input' | 'verification'>('input')
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [recaptchaReady, setRecaptchaReady] = useState(false)
  const [isInitializingRecaptcha, setIsInitializingRecaptcha] = useState(false)

  // Client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  // Check authentication state
  useEffect(() => {
    // Only run on client side when component is initialized
    if (!isClient) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await checkUserProfileAndRedirect(user)
      } else {
        setIsChecking(false)
      }
    })
    return () => unsubscribe()
  }, [router, isClient])

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timerId)
    }
  }, [timeLeft])

  // Initialize reCAPTCHA
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      initializeRecaptcha()
    }
    return () => {
      cleanupRecaptcha()
    }
  }, [])

  const cleanupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear()
      } catch (error) {
        console.log("Error clearing reCAPTCHA:", error)
      }
      window.recaptchaVerifier = null
    }
  }

  const initializeRecaptcha = async () => {
    try {
      setIsInitializingRecaptcha(true)
      
      // Clean up any existing reCAPTCHA
      cleanupRecaptcha()
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (!document.getElementById('recaptcha-container')) {
        console.error("reCAPTCHA container not found")
        return
      }

      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible',
          callback: () => {
            console.log("reCAPTCHA verified")
            setRecaptchaReady(true)
            setIsInitializingRecaptcha(false)
          },
          'expired-callback': () => {
            console.log("reCAPTCHA expired")
            setRecaptchaReady(false)
            toast.error("Verification expired. Please try again.")
          },
          'error-callback': (error: any) => {
            console.error("reCAPTCHA error:", error)
            setRecaptchaReady(false)
            setIsInitializingRecaptcha(false)
            toast.error("Verification error. Please refresh the page.")
          }
        }
      )

      await window.recaptchaVerifier.render()
      setIsInitializingRecaptcha(false)
      setRecaptchaReady(true)
    } catch (error) {
      console.error("reCAPTCHA initialization error:", error)
      setIsInitializingRecaptcha(false)
      setRecaptchaReady(false)
      toast.error("Unable to initialize phone verification. Please refresh the page.")
    }
  }

  const checkUserProfileAndRedirect = async (user: User) => {
    try {
      // Only run on client side
      if (typeof window === 'undefined') {
        setIsChecking(false);
        return;
      }

      // This is USER LOGIN - only check and create USER profiles
      console.log("🔵 User login page - checking USER profiles only");

      // Check user profile for regular users
      const userRef = doc(db, "Users", user.uid)
      const userSnap = await getDoc(userRef)
      
      if (userSnap.exists()) {
        const userData = userSnap.data()
        // Updated profile completion check: name, username, and contactEmail
        // Phone is automatically captured from authentication
        if (userData.username && userData.name && userData.contactEmail) {
          console.log("✅ User has complete profile, redirecting to profile...")
          router.push("/profile")
          return
        } else {
          // User exists but profile is incomplete
          console.log("📝 User exists but profile incomplete, showing form...")
          console.log("Profile check:", {
            name: !!userData.name,
            username: !!userData.username,
            contactEmail: !!userData.contactEmail
          });
          setCurrentUser(user)
          setFormData({
            name: userData.name || user.displayName || "",
            username: userData.username || "",
            contactEmail: userData.contactEmail || "",
          })
          setShowPostLoginForm(true)
          return
        }
      }
      
      // User document doesn't exist, show form to create USER profile
      console.log("📝 New user, needs to complete USER profile...")
      setCurrentUser(user)
      setFormData({
        name: user.displayName || "",
        username: "",
        contactEmail: "",
      })
      setShowPostLoginForm(true)
    } catch (error) {
      console.error("Error checking user profile:", error)
      toast.error("Error checking user profile. Please try again.")
      await signOut(auth)
    } finally {
      setIsChecking(false)
    }
  }

  const handlePhoneContinue = async () => {
    if (!phoneNumber) {
      toast.error("Please enter a phone number")
      return
    }

    if (timeLeft > 0) {
      toast.error(`Please wait ${timeLeft} seconds before trying again`)
      return
    }

    setLoading(true)

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`
      
      // Ensure reCAPTCHA is initialized
      if (!window.recaptchaVerifier) {
        console.log("Initializing reCAPTCHA...")
        await initializeRecaptcha()
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      if (!window.recaptchaVerifier) {
        throw new Error("reCAPTCHA initialization failed")
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.recaptchaVerifier
      )

      window.confirmationResult = confirmationResult
      setCurrentStep('verification')
      setTimeLeft(30)
      toast.success("OTP sent successfully!")
    } catch (error: any) {
      console.error("Error sending OTP:", error)
      
      if (error.code === 'auth/too-many-requests') {
        toast.error("Too many attempts. Please try again later.")
        setTimeLeft(60)
      } else if (error.code === 'auth/invalid-phone-number') {
        toast.error("Please enter a valid phone number.")
      } else if (error.code === 'auth/captcha-check-failed') {
        toast.error("Verification failed. Please refresh and try again.")
        cleanupRecaptcha()
        await initializeRecaptcha()
      } else {
        toast.error("Error sending OTP. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpVerification = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP")
      return
    }

    if (!window.confirmationResult) {
      toast.error("Session expired. Please request a new OTP.")
      setCurrentStep('input')
      return
    }

    setLoading(true)
    try {
      const result = await window.confirmationResult.confirm(otp)
      
      if (result.user) {
        await handleSuccessfulAuth(result.user, 'phone')
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error)
      if (error.code === 'auth/invalid-verification-code') {
        toast.error("Invalid OTP. Please check and try again.")
      } else if (error.code === 'auth/code-expired') {
        toast.error("OTP has expired. Please request a new one.")
        setCurrentStep('input')
      } else {
        toast.error("Invalid OTP. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSuccessfulAuth = async (user: any, provider: 'phone') => {
    try {
      const additionalData = { phone: phoneNumber }
      
      const { userData, navigationPath } = await handleAuthenticationFlow(user, provider, additionalData)
      
      if (userData.username && userData.name && userData.contactEmail) {
        toast.success("Welcome back!")
      } else if (userData.providers && Object.keys(userData.providers).length > 1) {
        toast.success("Account linked successfully!")
      } else {
        toast.success("Account created successfully!")
      }
      
      // Don't navigate here, let the auth state change handler take care of it
      // The checkUserProfileAndRedirect will handle the navigation
    } catch (error) {
      console.error("Error handling successful auth:", error)
      toast.error("Error completing login. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleBackToHome = () => {
    router.push("/")
  }

  const handleBackToInput = () => {
    setCurrentStep('input')
    setOtp('')
  }

  // Form validation and submission logic (rest remains the same)
  const validateForm = () => {
    const newErrors: Partial<FormData> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required"
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters"
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = "Username can only contain letters, numbers, and underscores"
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = "Contact email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = "Please enter a valid email address"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }



  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const usersQuery = query(
        collection(db, "Users"),
        where("username", "==", username.toLowerCase())
      )
      const querySnapshot = await getDocs(usersQuery)
      return querySnapshot.empty
    } catch (error) {
      console.error("Error checking username:", error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !currentUser) return

    setIsSubmitting(true)

    try {
      // Check username availability
      const isUsernameAvailable = await checkUsernameAvailability(formData.username)
      if (!isUsernameAvailable) {
        setErrors({ username: "Username is already taken" })
        setIsSubmitting(false)
        return
      }

      const userRef = doc(db, "Users", currentUser.uid)
      const updateData = {
        name: formData.name.trim(),
        username: formData.username.toLowerCase().trim(),
        contactEmail: formData.contactEmail.trim(),
        updatedAt: new Date().toISOString(),
      }

      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        await updateDoc(userRef, updateData)
      } else {
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email || "",
          photoURL: currentUser.photoURL || "",
          createdAt: new Date().toISOString(),
          ...updateData
        })
      }

      toast.success("Profile completed successfully!")
      router.push("/profile")
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("Error updating profile. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isChecking) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.card}>
            <div className={styles.cardContent}>
              <div className={styles.header}>
                <h1 className={styles.title}>Loading...</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showPostLoginForm) {
    return (
      <div className={styles.container}>
        {/* Animated Background */}
        <div className={styles.backgroundAnimation}>
          <div
            className={styles.mouseFollower}
            style={{
              left: mousePosition.x,
              top: mousePosition.y,
            }}
          />
          <div className={styles.gradientOrb1} />
          <div className={styles.gradientOrb2} />
          <div className={styles.gradientOrb3} />
        </div>

        <div className={styles.content}>
          <div className={styles.card}>
            <button onClick={handleBackToHome} className={styles.backToHome}>
              <ArrowLeft size={16} />
              Back to Home
            </button>

            <div className={styles.cardContent}>
              <div className={styles.header}>
                <h1 className={styles.title}>Complete Your Profile</h1>
                <p className={styles.subtitle}>Just a few more details to get started</p>
              </div>

              <form onSubmit={handleSubmit} className={styles.profileForm}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Name:</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={styles.profileInput}
                    placeholder="Enter your full name"
                  />
                  {errors.name && (
                    <span className={styles.error}>{errors.name}</span>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Username:</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value.toLowerCase())}
                    className={styles.profileInput}
                    placeholder="Choose a unique username"
                  />
                  {errors.username && (
                    <span className={styles.error}>{errors.username}</span>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Contact Email:</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    className={styles.profileInput}
                    placeholder="Enter your contact email"
                  />
                  {errors.contactEmail && (
                    <span className={styles.error}>{errors.contactEmail}</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isChecking || Object.values(errors).some(error => error)}
                  className={styles.completeButton}
                >
                  {isSubmitting ? 'Setting up...' : 'Complete Setup'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Animated Background */}
      <div className={styles.backgroundAnimation}>
        <div
          className={styles.mouseFollower}
          style={{
            left: mousePosition.x,
            top: mousePosition.y,
          }}
        />
        <div className={styles.gradientOrb1} />
        <div className={styles.gradientOrb2} />
        <div className={styles.gradientOrb3} />
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          {/* Back to Home Button */}
          <button onClick={handleBackToHome} className={styles.backToHome}>
            <ArrowLeft size={16} />
            Back to Home
          </button>

          <div className={styles.cardContent}>
            <div className={styles.header}>
              <h1 className={styles.title}>Welcome to Zest</h1>
              <p className={styles.subtitle}>Please sign in or sign up with your phone number</p>
            </div>

            {currentStep === 'input' ? (
              <>
                {/* Phone Input Section */}
                <div className={styles.primaryInputSection}>
                  <div className={styles.inputGroup}>
                    <div className={styles.inputHeader}>
                      <label className={styles.label}>Phone Number</label>
                    </div>
                    
                    <PhoneInput
                      international
                      defaultCountry="IN"
                      value={phoneNumber}
                      onChange={(value) => setPhoneNumber(value || "")}
                      className={styles.phoneNumberInput}
                      disabled={loading}
                    />
                  </div>

                  {/* Hidden reCAPTCHA Container */}
                  <div id="recaptcha-container" style={{ display: 'none' }}></div>

                  <button 
                    className={styles.continueButton}
                    onClick={handlePhoneContinue}
                    disabled={loading || timeLeft > 0 || isInitializingRecaptcha}
                  >
                    {loading ? "Sending..." : 
                     isInitializingRecaptcha ? "Initializing..." :
                     timeLeft > 0 ? `Wait ${timeLeft}s` : 
                     "Send OTP"}
                  </button>
                </div>

                {/* Organization Login Link */}
                <div className={styles.organizationLink}>
                  <p className={styles.organizationText}>Are you an organizer?</p>
                  <a href="/login/organisation" className={styles.organizationLinkBtn}>
                    Organization Login
                  </a>
                </div>
              </>
            ) : (
              /* OTP Verification Step */
              <div className={styles.verificationSection}>
                <div className={styles.verificationHeader}>
                  <button 
                    className={styles.backButton}
                    onClick={handleBackToInput}
                  >
                    ← Back
                  </button>
                  <h2 className={styles.verificationTitle}>Enter Verification Code</h2>
                </div>

                <div className={styles.otpVerificationContent}>
                  <p className={styles.verificationText}>
                    We've sent a 6-digit code to <strong>{phoneNumber}</strong>
                  </p>
                  <input
                    type="text"
                    className={styles.otpInput}
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    disabled={loading}
                  />
                  <button 
                    className={styles.verifyButton}
                    onClick={handleOtpVerification}
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 