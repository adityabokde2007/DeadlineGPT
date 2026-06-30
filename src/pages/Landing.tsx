import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import heroSectionBg from '../assets/hero_section.png';
import { CountUp } from '../components/CountUp';
import { 
  Play, 
  Calendar, 
  Bell, 
  Target, 
  BarChart3, 
  CheckCircle, 
  Star, 
  Sun, 
  Moon,
  Zap,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Brain,
  Clock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Github,
  Linkedin,
  ChevronUp,
  MapPin,
  ArrowUp,
  X,
  Menu
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import toast from 'react-hot-toast';
import TypewriterHeading from '../components/TypewriterHeading';



const REVIEWS = [
  {
    stars: 5,
    text: "I used to miss college submissions every week. DeadlineGPT planned my entire semester in one conversation. Absolute game changer.",
    name: "Priya Sharma",
    role: "Engineering Student, Pune"
  },
  {
    stars: 4,
    text: "The AI nudges are insanely smart. It knew my project was due before I even remembered. Never missed a client deadline since.",
    name: "Rahul Mehta",
    role: "Freelance Developer, Mumbai"
  },
  {
    stars: 5,
    text: "Finally a productivity app that actually thinks for you. The Gemini scheduling is frighteningly accurate.",
    name: "Ananya Singh",
    role: "Product Manager, Bangalore"
  },
  {
    stars: 4.5,
    text: "I submitted 3 assignments on time this month for the first time ever. DeadlineGPT is the only reason I passed my semester.",
    name: "Arjun Nair",
    role: "CS Student, Chennai"
  },
  {
    stars: 4,
    text: "The calendar sync with Google is seamless. My entire week gets planned automatically. Saves me at least 2 hours every Monday.",
    name: "Sneha Kulkarni",
    role: "UX Designer, Hyderabad"
  },
  {
    stars: 5,
    text: "Best productivity tool I have used in years. The voice input is surprisingly accurate and the nudges actually make me take action.",
    name: "Vikram Joshi",
    role: "Startup Founder, Delhi"
  }
];

const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const statsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const statsItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function Landing() {
  const { googleSignIn, currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = React.useState<string>('home');
  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [isHovered, setIsHovered] = React.useState<boolean>(false);
  const [visibleCards, setVisibleCards] = React.useState<number>(3);
  const [showScrollTop, setShowScrollTop] = React.useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = React.useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState<boolean>(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = React.useState<boolean>(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [isSendingMessage, setIsSendingMessage] = React.useState<boolean>(false);

  const sendEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;
    
    setIsSendingMessage(true);

    // TODO: User needs to replace these with their own EmailJS IDs
    // https://www.emailjs.com/
    emailjs.sendForm('service_7hvhu9r', 'template_xvr7ucn', formRef.current, 'aDJAx6GLY9Q3C_Mbg')
      .then(() => {
        toast.success('Message sent successfully! We will get back to you soon.');
        if (formRef.current) formRef.current.reset();
      }, (error) => {
        console.error(error.text);
        toast.error('Failed to send message. Please try again later.');
      })
      .finally(() => {
        setIsSendingMessage(false);
      });
  };
  const [loadingTime, setLoadingTime] = React.useState<number>(0);
  const [isScrolled, setIsScrolled] = React.useState<boolean>(false);

  const handleGoogleSignIn = async () => {
    if (currentUser) {
      navigate('/dashboard');
      return;
    }

    setIsSigningIn(true);
    setLoadingTime(0);
    
    // Start a timer to show "Still setting things up..." if taking too long
    const timer = setInterval(() => {
      setLoadingTime((prev) => prev + 1);
    }, 1000);

    try {
      await googleSignIn();
      navigate('/dashboard');
    } catch (error) {
      console.error("Failed to sign in with Google:", error);
      setIsSigningIn(false);
    } finally {
      clearInterval(timer);
    }
  };

  const isScrollingRef = React.useRef<boolean>(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const hasScrolledRef = React.useRef<boolean>(false);

  const updateActiveNav = React.useCallback((scrollY: number) => {
    const navbarHeight = 70;
    const sections = [
      { id: 'home', nav: 'Home' },
      { id: 'features', nav: 'Features' },
      { id: 'how-it-works', nav: 'Workflow' },
      { id: 'pricing', nav: 'Pricing' },
      { id: 'reviews', nav: 'Reviews' },
      { id: 'contact', nav: 'Contact' }
    ];
    
    if (scrollY < 50) {
      setActiveSection('home');
      return;
    }
    
    const totalHeight = document.documentElement.scrollHeight;
    const visibleHeight = window.innerHeight;
    if (visibleHeight + Math.round(scrollY) >= totalHeight - 15) {
      setActiveSection('contact');
      return;
    }

    let activeSectionId = 'home';
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) {
        const top = el.offsetTop - navbarHeight - 10;
        if (scrollY >= top) {
          activeSectionId = section.id;
        }
      }
    }
    setActiveSection(activeSectionId);
  }, []);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      if (scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }

      if (scrollY > 0) {
        hasScrolledRef.current = true;
      }

      if (scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      // If user clicked a nav link and we are smooth scrolling, don't override activeSection
      if (isScrollingRef.current) return;

      updateActiveNav(scrollY);
    };

    // On page load: set "Home" as active immediately before any scroll
    setActiveSection('home');
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [updateActiveNav]);

  const handleScrollToTop = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    isScrollingRef.current = false;
    hasScrolledRef.current = true;

    const startY = window.scrollY;
    const duration = 1200; // slower = more highlights visible
    const startTime = performance.now();
    
    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic - starts fast, slows near top
      const ease = 1 - Math.pow(1 - progress, 3);
      
      const currentY = startY * (1 - ease);
      window.scrollTo(0, currentY);
      
      // Update navbar highlight on every frame
      updateActiveNav(currentY);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        window.scrollTo(0, 0);
        updateActiveNav(0);
      }
    }
    
    requestAnimationFrame(animate);
    window.history.pushState(null, '', '#home');
  };

  React.useEffect(() => {
    const updateVisibleCards = () => {
      if (window.innerWidth < 768) {
        setVisibleCards(1);
      } else if (window.innerWidth < 1024) {
        setVisibleCards(2);
      } else {
        setVisibleCards(3);
      }
    };
    
    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  const maxIndex = REVIEWS.length - visibleCards;

  React.useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(Math.max(0, maxIndex));
    }
  }, [visibleCards, maxIndex, currentIndex]);

  // Auto scroll every 4 seconds unless hovered
  React.useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= maxIndex) {
          return 0; // wrap around
        } else {
          return prev + 1;
        }
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isHovered, maxIndex]);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    
    // Defer scroll to let the mobile menu close animation start first
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        isScrollingRef.current = true;
        hasScrolledRef.current = true;
        setActiveSection(id);
        
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        window.history.pushState(null, '', `#${id}`);
        
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = false;
        }, 1000);
      }
    }, 50);
  };

  const getLinkClass = (id: string) => {
    const isActive = activeSection === id;
    return `text-sm font-semibold transition-colors duration-200 pb-1 border-b-2 ${
      isActive 
        ? 'text-[#e07a5f] border-[#e07a5f] font-bold' 
        : 'text-on-surface-variant hover:text-[#e07a5f] border-transparent'
    }`;
  };

  return (
    <>
      <AnimatePresence>
        {isSigningIn && (
          <motion.div
            key="landing-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-on-surface select-none"
          >
            <div className="flex flex-col items-center gap-6 px-6 text-center">
              <motion.div 
                className="relative flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative">
                   <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin" style={{ animationDuration: '3s' }}></div>
                   <Sparkles size={24} className="text-primary animate-pulse" />
                </div>
              </motion.div>
              <div>
                <h4 className="text-xl font-bold tracking-tight text-on-surface mb-2">DeadlineGPT</h4>
                <p className="text-sm font-semibold text-on-surface-variant/80">
                  {loadingTime > 10 ? "Still setting things up..." : "Authenticating..."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="bg-background text-on-background min-h-screen transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'bg-background/80 backdrop-blur-md border-b border-outline-variant shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]' : 'bg-background border-b border-transparent'}`}>
        <nav className="relative flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center">
            <span className="text-xl md:text-2xl font-extrabold tracking-tight font-sans select-none">
              <span className="text-on-surface">Deadline</span>
              <span className="text-[#e07a5f]">GPT</span>
            </span>
          </Link>

          <div className="hidden md:flex justify-center items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <a 
              href="#home" 
              onClick={(e) => scrollToSection(e, 'home')}
              className={getLinkClass('home')}
            >
              Home
            </a>
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className={getLinkClass('features')}
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className={getLinkClass('how-it-works')}
            >
              Workflow
            </a>
            <a 
              href="#pricing" 
              onClick={(e) => scrollToSection(e, 'pricing')}
              className={getLinkClass('pricing')}
            >
              Pricing
            </a>
            <a 
              href="#reviews" 
              onClick={(e) => scrollToSection(e, 'reviews')}
              className={getLinkClass('reviews')}
            >
              Reviews
            </a>
            <a 
              href="#contact" 
              onClick={(e) => scrollToSection(e, 'contact')}
              className={getLinkClass('contact')}
            >
              Contact
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={handleGoogleSignIn} 
              className="hidden sm:block text-on-surface-variant font-semibold text-sm px-4 py-2 hover:text-primary transition-colors cursor-pointer"
            >
              Log In
            </button>
            <button 
              onClick={handleGoogleSignIn} 
              className="bg-primary-container text-on-primary-container px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg text-sm font-bold active:scale-95 transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:scale-[1.03] cursor-pointer"
            >
              Sign Up
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden fixed top-[70px] left-0 right-0 bg-background/95 backdrop-blur-md border-b border-outline-variant shadow-lg z-40 overflow-hidden"
          >
            <div className="flex flex-col px-6 py-4 gap-4">
              <button onClick={(e) => scrollToSection(e, 'home')} className={`text-left ${getLinkClass('home')}`}>Home</button>
              <button onClick={(e) => scrollToSection(e, 'features')} className={`text-left ${getLinkClass('features')}`}>Features</button>
              <button onClick={(e) => scrollToSection(e, 'how-it-works')} className={`text-left ${getLinkClass('how-it-works')}`}>Workflow</button>
              <button onClick={(e) => scrollToSection(e, 'pricing')} className={`text-left ${getLinkClass('pricing')}`}>Pricing</button>
              <button onClick={(e) => scrollToSection(e, 'reviews')} className={`text-left ${getLinkClass('reviews')}`}>Reviews</button>
              <button onClick={(e) => scrollToSection(e, 'contact')} className={`text-left ${getLinkClass('contact')}`}>Contact</button>
              <div className="h-px bg-outline-variant/60 my-2"></div>
              <button onClick={() => { handleGoogleSignIn(); setIsMobileMenuOpen(false); }} className="text-center font-semibold text-sm py-2 text-on-surface hover:text-primary transition-colors w-full border border-outline-variant rounded-lg">Log In</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="pt-24">
        {/* Hero Section */}
        <section id="home" className="scroll-mt-20">
          <div className="relative overflow-hidden w-full flex flex-col justify-center min-h-[600px] pt-16 pb-20">
            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0">
              <img 
                src={heroSectionBg} 
                alt="Abstract background shapes" 
                className="w-full h-full object-cover object-top"
              />
              {/* Subtle cream/white gradient overlay at the top for text contrast */}
              <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/40 to-transparent"></div>
            </div>

            <motion.div 
              variants={heroContainerVariants}
              initial="hidden"
              animate="visible"
              className="relative z-10 px-6 max-w-7xl mx-auto flex flex-col items-center text-center w-full"
            >
              <motion.div variants={heroItemVariants}>
                <motion.span 
                  animate={{ y: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-primary/30 text-primary text-xs font-semibold uppercase tracking-widest mb-8 bg-primary/5 bg-background/50 backdrop-blur-sm"
                >
                  <Zap size={12} />
                  AI-Powered Productivity
                </motion.span>
              </motion.div>
              <motion.div variants={heroItemVariants} className="w-full">
                <TypewriterHeading />
              </motion.div>
              <motion.p variants={heroItemVariants} className="text-lg md:text-xl text-on-surface-variant max-w-2xl mb-10 leading-relaxed font-normal">
                DeadlineGPT is your AI-powered productivity companion. Describe your tasks in plain language — Gemini plans, prioritizes, and schedules everything for you automatically.
              </motion.p>
              <motion.div variants={heroItemVariants} className="flex flex-col sm:flex-row gap-4 w-full justify-center px-4 max-w-md">
                <button 
                  onClick={handleGoogleSignIn}
                  className="bg-primary-container text-on-primary-container px-6 py-3.5 rounded-lg text-sm font-bold active:scale-95 transition-all duration-200 ease-out text-center shadow-sm hover:shadow-md flex items-center justify-center hover:scale-[1.03] cursor-pointer"
                >
                  Start For Free
                </button>
                <button 
                  onClick={() => setIsVideoModalOpen(true)}
                  className="px-6 py-3.5 rounded-lg border border-outline-variant text-sm font-bold bg-background/50 backdrop-blur-sm hover:bg-surface-variant text-on-surface transition-all duration-200 ease-out hover:shadow-md cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.03]"
                >
                  <Play size={16} fill="currentColor" className="shrink-0" />
                  Watch Workflow
                </button>
              </motion.div>
            </motion.div>
          </div>

          <div className="px-6 pb-20 bg-background relative z-10">
            <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
              {/* Stats Cards Section */}
              <motion.div 
                variants={statsContainerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto"
              >
                {/* Card 1 */}
              <motion.div variants={statsItemVariants} id="stat-card-1" className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-primary/30 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_0_rgba(0,0,0,0.08)]">
                <span className="text-5xl md:text-7xl font-black tracking-tight text-[#e07a5f] mb-3"><CountUp end={10} suffix="x" /></span>
                <span className="text-lg font-bold text-on-surface mb-1">Faster Planning</span>
                <span className="text-sm text-on-surface-variant font-normal">Compared to manual scheduling</span>
              </motion.div>

              {/* Card 2 */}
              <motion.div variants={statsItemVariants} id="stat-card-2" className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-primary/30 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_0_rgba(0,0,0,0.08)]">
                <span className="text-5xl md:text-7xl font-black tracking-tight text-[#e07a5f] mb-3"><CountUp end={100} suffix="%" /></span>
                <span className="text-lg font-bold text-on-surface mb-1">AI Powered</span>
                <span className="text-sm text-on-surface-variant font-normal">Every decision made by Gemini</span>
              </motion.div>

              {/* Card 3 */}
              <motion.div variants={statsItemVariants} id="stat-card-3" className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-primary/30 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_0_rgba(0,0,0,0.08)]">
                <span className="text-5xl md:text-7xl font-black tracking-tight text-[#e07a5f] mb-3">0</span>
                <span className="text-lg font-bold text-on-surface mb-1">Missed Deadlines</span>
                <span className="text-sm text-on-surface-variant font-normal">When you follow your schedule</span>
              </motion.div>
            </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <motion.section 
          id="features" 
          className="py-20 px-6 max-w-7xl mx-auto scroll-mt-20"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-on-surface">Everything You Need to Beat Deadlines</h2>
            <p className="text-base text-on-surface-variant max-w-xl mx-auto font-normal">
              AI planning, smart scheduling, proactive nudges — every tool built to keep you ahead of every deadline.
            </p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {/* Card 1: AI-Powered Scheduling */}
            <motion.div variants={cardVariants} className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col justify-start transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/30 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Calendar className="text-primary" size={24} />
              </div>
              <div className="h-px w-12 bg-outline-variant/60 my-5"></div>
              <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mb-4 text-on-surface">AI-Powered Scheduling</h3>
              <p className="text-sm text-on-surface-variant font-normal leading-relaxed">
                Tell DeadlineGPT your available hours. Gemini automatically fits your tasks into optimal time slots and builds your daily schedule.
              </p>
            </motion.div>

            {/* Card 2: Smart Proactive Nudges */}
            <motion.div variants={cardVariants} className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col justify-start transition-all duration-200 ease-out hover:-translate-y-1 hover:border-secondary/35 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                <Bell className="text-secondary" size={24} />
              </div>
              <div className="h-px w-12 bg-outline-variant/60 my-5"></div>
              <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mb-4 text-on-surface">Smart Proactive Nudges</h3>
              <p className="text-sm text-on-surface-variant font-normal leading-relaxed">
                Get context-aware alerts like 'Your assignment is due tomorrow — start now' instead of generic reminders you ignore.
              </p>
            </motion.div>

            {/* Card 3: Deep Focus Mode */}
            <motion.div variants={cardVariants} className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col justify-start transition-all duration-200 ease-out hover:-translate-y-1 hover:border-tertiary/35 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-tertiary/20 border border-tertiary/30 flex items-center justify-center">
                <Target className="text-tertiary" size={24} />
              </div>
              <div className="h-px w-12 bg-outline-variant/60 my-5"></div>
              <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mb-4 text-on-surface">Deep Focus Mode</h3>
              <p className="text-sm text-on-surface-variant font-normal leading-relaxed">
                Block distractions and enter a distraction-free workspace. Only your most urgent deadlines remain visible.
              </p>
            </motion.div>

            {/* Card 4: Performance Analytics */}
            <motion.div variants={cardVariants} className="bg-surface-container-low border border-outline-variant/70 rounded-2xl p-10 flex flex-col justify-start transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/30 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <BarChart3 className="text-primary" size={24} />
              </div>
              <div className="h-px w-12 bg-outline-variant/60 my-5"></div>
              <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mb-4 text-on-surface">Performance Analytics</h3>
              <p className="text-sm text-on-surface-variant font-normal leading-relaxed">
                Track your completion rate, streaks, and productivity score. Visualize your deadline history in one clean dashboard.
              </p>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* How It Works Section */}
        <motion.section 
          id="how-it-works" 
          className="py-20 px-6 max-w-7xl mx-auto scroll-mt-20"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How It Works</h2>
            <p className="text-base text-on-surface-variant max-w-xl mx-auto font-normal">
              Get set up and master your scheduling workflow in three simple steps.
            </p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {/* Card 1 */}
            <motion.div variants={cardVariants} className="relative bg-surface-container-low border border-outline-variant rounded-xl p-8 flex flex-col justify-between overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/30 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="absolute top-6 right-6 text-4xl font-mono font-bold text-on-surface-variant/20">01</div>
              <div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                  <MessageSquare className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-3">Describe Your Task</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed font-normal">
                  Type or speak your deadline in plain language. No forms, no dropdowns — just tell DeadlineGPT what you need to get done.
                </p>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div variants={cardVariants} className="relative bg-surface-container-low border border-outline-variant rounded-xl p-8 flex flex-col justify-between overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 hover:border-secondary/35 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="absolute top-6 right-6 text-4xl font-mono font-bold text-on-surface-variant/20">02</div>
              <div>
                <div className="w-12 h-12 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-6">
                  <Sparkles className="text-secondary" size={24} />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-3">Gemini Plans It</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed font-normal">
                  Our AI powered by Google Gemini breaks your goal into subtasks, estimates time, and builds your perfect daily schedule automatically.
                </p>
              </div>
            </motion.div>

            {/* Card 3 */}
            <motion.div variants={cardVariants} className="relative bg-surface-container-low border border-outline-variant rounded-xl p-8 flex flex-col justify-between overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 hover:border-tertiary/35 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div className="absolute top-6 right-6 text-4xl font-mono font-bold text-on-surface-variant/20">03</div>
              <div>
                <div className="w-12 h-12 rounded-lg bg-tertiary/10 border border-tertiary/20 flex items-center justify-center mb-6">
                  <Bell className="text-tertiary" size={24} />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-3">Never Miss Again</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed font-normal">
                  Get smart proactive nudges with context. Track streaks, completion rates, and stay ahead of every deadline effortlessly.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Pricing Section */}
        <motion.section 
          id="pricing" 
          className="py-20 px-6 max-w-7xl mx-auto scroll-mt-20"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-on-surface">Flexible Plans for Every Pace</h2>
            <p className="text-base text-on-surface-variant max-w-xl mx-auto font-normal">
              Choose the perfect plan to streamline your workflow and conquer your deadlines.
            </p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {/* Plan 1 - Free */}
            <motion.div variants={cardVariants} className="bg-background border border-outline-variant/60 rounded-2xl p-8 flex flex-col justify-between transition-all duration-200 ease-out hover:scale-[1.02] hover:border-[#e07a5f] shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg">
              <div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Free</h3>
                <div className="flex items-baseline gap-1 my-6">
                  <span className="text-4xl font-extrabold tracking-tight text-on-surface">₹0</span>
                  <span className="text-sm text-on-surface-variant font-medium">/month</span>
                </div>
                <div className="h-px bg-outline-variant/60 my-6"></div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface-variant font-medium">Up to 5 tasks per day</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface-variant font-medium">Basic AI planning</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface-variant font-medium">Smart nudges</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface-variant font-medium">Mobile friendly</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={handleGoogleSignIn}
                className="w-full text-center py-3 rounded-lg font-bold text-sm border border-outline-variant text-on-surface hover:bg-surface-variant active:scale-[0.98] transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-md cursor-pointer"
              >
                Get Started Free
              </button>
            </motion.div>

            {/* Plan 2 - Pro (Most Popular) */}
            <motion.div variants={cardVariants} className="relative bg-background border-2 border-[#e07a5f] rounded-2xl p-8 flex flex-col justify-between transition-all duration-200 ease-out hover:scale-[1.02] shadow-[0_8px_30px_0_rgba(224,122,95,0.08)] hover:shadow-[0_12px_40px_0_rgba(224,122,95,0.15)]">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#e07a5f] text-white text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">
                Most Popular
              </span>
              <div>
                <h3 className="text-xl font-bold text-on-surface mb-2 mt-2">Pro</h3>
                <div className="flex items-baseline gap-1 my-6">
                  <span className="text-4xl font-extrabold tracking-tight text-on-surface">₹199</span>
                  <span className="text-sm text-on-surface-variant font-medium">/month</span>
                </div>
                <div className="h-px bg-outline-variant/60 my-6"></div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface font-medium">Unlimited tasks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface font-medium">Gemini AI scheduling</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface font-medium">Google Calendar sync</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface font-medium">Voice input</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-[#e07a5f] flex-shrink-0" />
                    <span className="text-sm text-on-surface font-medium">Priority support</span>
                  </li>
                </ul>
              </div>
              <a 
                href="#contact"
                onClick={(e) => scrollToSection(e, 'contact')}
                className="w-full text-center py-3 rounded-lg font-bold text-sm bg-[#e07a5f] hover:bg-[#d0694e] text-white active:scale-[0.98] transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-md shadow-sm cursor-pointer block"
              >
                Contact Us
              </a>
            </motion.div>

            {/* Plan 3 - Team */}
            <motion.div variants={cardVariants} className="bg-background border border-outline-variant/60 rounded-2xl p-8 flex flex-col justify-between transition-all duration-200 ease-out hover:scale-[1.02] hover:border-[#e07a5f] shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg opacity-75">
              <div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Team</h3>
                <div className="flex items-baseline gap-1 my-6">
                  <span className="text-4xl font-extrabold tracking-tight text-on-surface">₹499</span>
                  <span className="text-sm text-on-surface-variant font-medium">/month</span>
                </div>
                <div className="h-px bg-outline-variant/60 my-6"></div>
                <div className="flex flex-col items-center justify-center py-10">
                  <span className="inline-block px-4 py-1.5 bg-[#e07a5f]/15 border border-[#e07a5f]/30 text-[#e07a5f] rounded-full text-xs font-bold uppercase tracking-wider">
                    Coming Soon
                  </span>
                  <p className="text-xs text-on-surface-variant text-center font-normal mt-3">
                    Team features are on the way. Stay tuned.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Reviews Section */}
        <motion.section 
          id="reviews" 
          className="py-20 px-6 max-w-7xl mx-auto scroll-mt-20 relative overflow-hidden"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-on-surface">Loved by Students & Professionals</h2>
            <p className="text-base text-on-surface-variant max-w-xl mx-auto font-normal">
              Real people. Real deadlines. Real results.
            </p>
          </div>

          <div className="relative">
            {/* Reviews Container */}
            <div className="flex flex-col md:flex-row overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-6 pb-8 pt-4">
              {REVIEWS.map((review, idx) => {
                const fullStars = Math.floor(review.stars);
                const hasHalf = review.stars % 1 !== 0;
                const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
                return (
                  <motion.div 
                    key={idx} 
                    className="shrink-0 w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-center"
                    variants={cardVariants}
                  >
                    <div className="bg-background border border-outline-variant/60 rounded-2xl p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-lg duration-200 transition-all flex flex-col justify-between h-full min-h-[300px]">
                      <div>
                        <div className="flex gap-1 items-center mb-6">
                          {[...Array(fullStars)].map((_, i) => (
                            <Star key={`full-${i}`} size={18} className="fill-[#e07a5f] text-[#e07a5f]" />
                          ))}
                          {hasHalf && (
                            <div className="relative inline-block w-[18px] h-[18px]" style={{ minWidth: '18px' }} key="half">
                              <Star size={18} className="text-[#e07a5f]" />
                              <div className="absolute top-0 left-0 overflow-hidden w-[9px] h-[18px]">
                                <Star size={18} className="fill-[#e07a5f] text-[#e07a5f]" />
                              </div>
                            </div>
                          )}
                          {[...Array(emptyStars)].map((_, i) => (
                            <Star key={`empty-${i}`} size={18} className="text-[#e07a5f]/40" />
                          ))}
                        </div>
                        <p className="text-base text-on-surface italic leading-relaxed mb-8">
                          "{review.text}"
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-6 border-t border-outline-variant/40 mt-auto">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0">
                          {review.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-on-surface">{review.name}</div>
                          <div className="text-xs text-on-surface-variant font-normal">{review.role}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Scroll instruction for mobile */}
            <div className="flex justify-center mt-2 md:hidden">
              <span className="text-xs text-on-surface-variant">Swipe to see more</span>
            </div>
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section 
          id="contact" 
          className="bg-background border-t border-b border-outline-variant/30 py-20 px-6 scroll-mt-20 theme-transition transition-colors duration-200"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="max-w-[700px] mx-auto w-full">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-on-surface">Get In Touch</h2>
              <p className="text-base text-on-surface-variant max-w-xl mx-auto font-normal">
                Have a question or want to collaborate?
              </p>
            </div>

            {/* Two rows of info badges */}
            <div className="flex flex-col gap-4 items-center mb-10">
              {/* Row 1 - Three icon+text badges side by side */}
              <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3.5 w-full">
                {/* Badge 1: Email */}
                <a 
                  href="mailto:bokdeaditya77@gmail.com"
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-outline-variant/60 bg-background text-sm font-semibold text-on-surface hover:border-[#e07a5f] hover:text-[#e07a5f] transition-all duration-300 shadow-sm"
                >
                  <Mail size={16} className="text-[#e07a5f] shrink-0" />
                  <span>bokdeaditya77@gmail.com</span>
                </a>

                {/* Badge 2: GitHub */}
                <a 
                  href="https://github.com/adityabokde2007"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-outline-variant/60 bg-background text-sm font-semibold text-on-surface hover:border-[#e07a5f] hover:text-[#e07a5f] transition-all duration-300 shadow-sm"
                >
                  <Github size={16} className="text-[#e07a5f] shrink-0" />
                  <span>github.com/adityabokde2007</span>
                </a>

                {/* Badge 3: LinkedIn */}
                <a 
                  href="https://www.linkedin.com/in/aditya-bokde-ab0b59341/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-outline-variant/60 bg-background text-sm font-semibold text-on-surface hover:border-[#e07a5f] hover:text-[#e07a5f] transition-all duration-300 shadow-sm"
                >
                  <Linkedin size={16} className="text-[#e07a5f] shrink-0" />
                  <span>Aditya Bokde</span>
                </a>
              </div>
            </div>

            {/* Below Badges - Contact Form Card */}
            <form 
              ref={formRef}
              onSubmit={sendEmail}
              className="bg-background border border-outline-variant/60 rounded-2xl p-8 md:p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] flex flex-col gap-6"
            >
              <h3 className="text-xl font-bold text-on-surface text-left">Send a Message</h3>
              
              {/* Name field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant text-left">Your Name</label>
                <input 
                  type="text" 
                  id="name"
                  name="user_name"
                  required
                  placeholder="Your Name" 
                  className="bg-background text-on-surface border border-outline-variant/60 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e07a5f] text-sm w-full transition-colors"
                />
              </div>

              {/* Email field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant text-left">Your Email</label>
                <input 
                  type="email" 
                  id="email"
                  name="user_email"
                  required
                  placeholder="Your Email" 
                  className="bg-background text-on-surface border border-outline-variant/60 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e07a5f] text-sm w-full transition-colors"
                />
              </div>

              {/* Your Message */}
              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant text-left">Your Message</label>
                <textarea 
                  id="message"
                  name="message"
                  required
                  rows={4}
                  placeholder="Your Message" 
                  className="bg-background text-on-surface border border-outline-variant/60 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e07a5f] text-sm w-full transition-colors resize-none"
                />
              </div>

              <div>
                <button 
                  type="submit"
                  disabled={isSendingMessage}
                  className="bg-[#e07a5f] hover:bg-[#d0694e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 ease-out w-full text-center cursor-pointer active:scale-[0.98] shadow-sm hover:shadow-md hover:scale-[1.02] mb-3"
                >
                  {isSendingMessage ? 'Sending...' : 'Send Message'}
                </button>
                <p className="text-xs text-on-surface-variant text-center mt-2 font-normal">I usually respond within 24 hours</p>
              </div>
            </form>
          </div>
        </motion.section>
      </main>

      {/* Footer Element */}
      <footer className="bg-neutral-950 border-t border-neutral-900 text-neutral-400 pt-16 pb-2 md:pt-20 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 items-start text-left">
          {/* COLUMN 1 */}
          <div className="flex flex-col gap-4 items-center text-center md:items-start md:text-left">
            <div className="flex items-center md:mx-0 mx-auto">
              <span className="text-2xl font-extrabold tracking-tight font-sans select-none">
                <span className="text-white">Deadline</span>
                <span className="text-[#e07a5f]">GPT</span>
              </span>
            </div>
            <p className="text-base font-semibold text-neutral-200">Never miss what matters.</p>
            <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
              AI-powered deadline companion.
            </p>
            <div className="flex items-center gap-6 mt-2 justify-center md:justify-start">
              <a 
                href="https://github.com/adityabokde2007" 
                target="_blank" 
                rel="noopener noreferrer"
                title="GitHub"
                className="text-white hover:text-[#e07a5f] transition-all transform hover:scale-110 duration-200"
              >
                <Github size={20} />
              </a>
              <a 
                href="https://www.linkedin.com/in/aditya-bokde-ab0b59341/" 
                target="_blank" 
                rel="noopener noreferrer"
                title="LinkedIn"
                className="text-white hover:text-[#e07a5f] transition-all transform hover:scale-110 duration-200"
              >
                <Linkedin size={20} />
              </a>
              <a 
                href="mailto:bokdeaditya77@gmail.com" 
                title="Email"
                className="text-white hover:text-[#e07a5f] transition-all transform hover:scale-110 duration-200"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* COLUMN 2 */}
          <div className="flex flex-col gap-4 items-start text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">QUICK LINKS</h4>
            <ul className="flex flex-col gap-2.5 text-sm font-medium">
              <li>
                <a 
                  href="#home" 
                  onClick={(e) => scrollToSection(e, 'home')}
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a 
                  href="#features" 
                  onClick={(e) => scrollToSection(e, 'features')}
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a 
                  href="#how-it-works" 
                  onClick={(e) => scrollToSection(e, 'how-it-works')}
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors"
                >
                  Workflow
                </a>
              </li>
              <li>
                <a 
                  href="#pricing" 
                  onClick={(e) => scrollToSection(e, 'pricing')}
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a 
                  href="#reviews" 
                  onClick={(e) => scrollToSection(e, 'reviews')}
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors"
                >
                  Reviews
                </a>
              </li>
              <li>
                <a 
                  href="#contact" 
                  onClick={(e) => scrollToSection(e, 'contact')}
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* COLUMN 3 */}
          <div className="flex flex-col gap-4 items-start text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">CONTACT</h4>
            <ul className="flex flex-col gap-3 text-sm font-medium">
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="text-[#e07a5f] shrink-0" />
                <a 
                  href="mailto:bokdeaditya77@gmail.com" 
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors break-all"
                >
                  bokdeaditya77@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Linkedin size={16} className="text-[#e07a5f] shrink-0" />
                <a 
                  href="https://www.linkedin.com/in/aditya-bokde-ab0b59341/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors break-all"
                >
                  aditya-bokde-ab0b59341
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Github size={16} className="text-[#e07a5f] shrink-0" />
                <a 
                  href="https://github.com/adityabokde2007" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-neutral-300 hover:text-[#e07a5f] transition-colors break-all"
                >
                  adityabokde2007
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-neutral-400">
                <MapPin size={16} className="text-[#e07a5f] shrink-0" />
                <span>Nagpur, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="max-w-7xl mx-auto border-t border-neutral-800/80 mt-12 pt-6 pb-2 text-center text-sm text-neutral-200 font-medium">
          <span>© 2026 DeadlineGPT. All rights reserved.</span>
        </div>
      </footer>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsVideoModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-[4/3] sm:aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer backdrop-blur-md border border-white/10"
              >
                <X size={20} />
              </button>
              <iframe 
                src="https://drive.google.com/file/d/1tTRR1Cv-dD6Imb-GnG6NKsU5qiDzWSwn/preview" 
                className="w-full h-full border-0" 
                allow="autoplay; fullscreen"
                allowFullScreen
                title="DeadlineGPT Workflow Video"
              ></iframe>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Scroll to Top Button */}
      <button
        onClick={handleScrollToTop}
        className={`fixed bottom-6 right-6 z-[999] flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-[#e07a5f] text-white border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-all duration-200 ease-out hover:bg-[#d0694e] hover:-translate-y-[2px] active:scale-95 cursor-pointer ${
          showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp size={20} strokeWidth={2} className="text-white" />
      </button>
    </div>
    </>
  );
}
