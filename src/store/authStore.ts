import { create } from 'zustand';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import supabase from '@/lib/supabase/client';

export interface StudentProfile {
  id: string; // Firebase UID
  email: string;
  name: string;
  phone?: string;
  board?: string;
  class_name?: string;
  subject?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MockTestAttempt {
  id: string;
  board: string;
  class_name: string;
  subject: string;
  score: number;
  total_questions: number;
  duration_seconds: number;
  created_at: string;
}

export interface Certificate {
  id: string;
  certificate_id: string;
  board: string;
  class_name: string;
  subject: string;
  score: number;
  percentage: number;
  created_at: string;
}

interface AuthState {
  user: User | null;
  studentProfile: StudentProfile | null;
  loading: boolean;
  profileLoading: boolean;
  previousTests: MockTestAttempt[];
  certificates: Certificate[];
  loginWithGoogle: () => Promise<User | null>;
  loginWithEmail: (email: string, password: string) => Promise<User | null>;
  signupWithEmail: (email: string, password: string, name: string) => Promise<User | null>;
  logout: () => Promise<void>;
  updateStudentProfile: (details: Partial<StudentProfile>) => Promise<boolean>;
  loadStudentProfile: (uid: string) => Promise<StudentProfile | null>;
  loadTestHistory: (uid: string) => Promise<void>;
  loadCertificates: (uid: string) => Promise<void>;
  initializeAuthListener: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  studentProfile: null,
  loading: true,
  profileLoading: false,
  previousTests: [],
  certificates: [],

  initializeAuthListener() {
    const isFirebaseConfigured = 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "dummy-key-for-development";

    if (!isFirebaseConfigured) {
      console.log('Firebase is not configured. Running in Direct Supabase Auth Fallback mode.');
      if (typeof window !== 'undefined') {
        const savedSession = localStorage.getItem('qb_student_session');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            set({ 
              user: parsed.user, 
              studentProfile: parsed.profile, 
              loading: false 
            });
            get().loadTestHistory(parsed.user.uid);
            get().loadCertificates(parsed.user.uid);
            return;
          } catch (e) {
            localStorage.removeItem('qb_student_session');
          }
        }
      }
      set({ loading: false });
      return;
    }

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        set({ user: firebaseUser, loading: false });
        await get().loadStudentProfile(firebaseUser.uid);
        await get().loadTestHistory(firebaseUser.uid);
        await get().loadCertificates(firebaseUser.uid);
      } else {
        set({ user: null, studentProfile: null, previousTests: [], certificates: [], loading: false });
      }
    });
  },

  async loginWithGoogle() {
    const isFirebaseConfigured = 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "dummy-key-for-development";

    if (!isFirebaseConfigured) {
      throw new Error('Google Sign-In is only available when Firebase is configured. Please use Email/Password Sign Up instead.');
    }

    set({ loading: true });
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Auto-create/load profile on login
      if (result.user) {
        await get().loadStudentProfile(result.user.uid);
        // Create initial profile if missing in Supabase
        const currentProfile = get().studentProfile;
        if (!currentProfile) {
          await get().updateStudentProfile({
            id: result.user.uid,
            email: result.user.email || '',
            name: result.user.displayName || 'Student',
          });
        }
      }
      return result.user;
    } catch (error) {
      console.error('Google Sign In Error:', error);
      set({ loading: false });
      throw error;
    }
  },

  async loginWithEmail(email, password) {
    set({ loading: true });
    const isFirebaseConfigured = 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "dummy-key-for-development";

    if (!isFirebaseConfigured) {
      try {
        const { data: student, error } = await supabase
          .from('students')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (error) throw error;
        if (!student) {
          throw new Error('No student account found with this email. Please click "Sign Up" above to create an account.');
        }

        const simulatedUser = {
          uid: student.id,
          email: student.email,
          displayName: student.name,
        } as any;

        set({ 
          user: simulatedUser, 
          studentProfile: student, 
          loading: false 
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('qb_student_session', JSON.stringify({
            user: simulatedUser,
            profile: student
          }));
        }

        await get().loadTestHistory(student.id);
        await get().loadCertificates(student.id);

        return simulatedUser;
      } catch (error: any) {
        console.error('Direct Supabase Login Error:', error);
        set({ loading: false });
        throw error;
      }
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await get().loadStudentProfile(result.user.uid);
      return result.user;
    } catch (error) {
      console.error('Email Login Error:', error);
      set({ loading: false });
      throw error;
    }
  },

  async signupWithEmail(email, password, name) {
    set({ loading: true });
    const isFirebaseConfigured = 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "dummy-key-for-development";

    if (!isFirebaseConfigured) {
      try {
        const { data: existingStudent, error: checkError } = await supabase
          .from('students')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existingStudent) {
          throw new Error('An account with this email address already exists. Try signing in!');
        }

        const studentId = 'db-' + Math.random().toString(36).substr(2, 9);
        const profile = {
          id: studentId,
          email,
          name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('students')
          .insert(profile);

        if (insertError) throw insertError;

        const simulatedUser = {
          uid: studentId,
          email,
          displayName: name,
        } as any;

        set({ 
          user: simulatedUser, 
          studentProfile: profile, 
          loading: false 
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('qb_student_session', JSON.stringify({
            user: simulatedUser,
            profile
          }));
        }

        await get().loadTestHistory(studentId);
        await get().loadCertificates(studentId);

        return simulatedUser;
      } catch (error: any) {
        console.error('Direct Supabase Signup Error:', error);
        set({ loading: false });
        throw error;
      }
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create student profile in Supabase
      await get().updateStudentProfile({
        id: result.user.uid,
        email,
        name,
      });

      return result.user;
    } catch (error) {
      console.error('Email Signup Error:', error);
      set({ loading: false });
      throw error;
    }
  },

  async logout() {
    set({ loading: true });
    const isFirebaseConfigured = 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "dummy-key-for-development";

    if (typeof window !== 'undefined') {
      localStorage.removeItem('qb_student_session');
    }

    if (!isFirebaseConfigured) {
      set({ user: null, studentProfile: null, previousTests: [], certificates: [], loading: false });
      return;
    }

    try {
      await signOut(auth);
      set({ user: null, studentProfile: null, previousTests: [], certificates: [], loading: false });
    } catch (error) {
      console.error('Logout Error:', error);
      set({ loading: false });
      throw error;
    }
  },

  async loadStudentProfile(uid) {
    set({ profileLoading: true });
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({ studentProfile: data, profileLoading: false });
        return data as StudentProfile;
      } else {
        set({ studentProfile: null, profileLoading: false });
        return null;
      }
    } catch (error) {
      console.error('Load Student Profile Error:', error);
      set({ studentProfile: null, profileLoading: false });
      return null;
    }
  },

  async updateStudentProfile(details) {
    const firebaseUser = get().user;
    if (!firebaseUser) return false;

    set({ profileLoading: true });
    const profileId = details.id || firebaseUser.uid;
    const email = details.email || firebaseUser.email || '';

    const payload = {
      ...details,
      id: profileId,
      email,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('students')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      await get().loadStudentProfile(profileId);
      return true;
    } catch (error) {
      console.error('Update Student Profile Error:', error);
      set({ profileLoading: false });
      return false;
    }
  },

  async loadTestHistory(uid) {
    try {
      const { data, error } = await supabase
        .from('mock_tests')
        .select('*')
        .eq('student_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ previousTests: data || [] });
    } catch (error) {
      console.error('Load Test History Error:', error);
    }
  },

  async loadCertificates(uid) {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('student_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ certificates: data || [] });
    } catch (error) {
      console.error('Load Certificates Error:', error);
    }
  },
}));
