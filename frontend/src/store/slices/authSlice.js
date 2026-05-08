import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';

// Initialize state from localStorage to prevent flash redirects on refresh
const getInitialState = () => {
  try {
    const storedUser = localStorage.getItem('currentUser');
    const storedPortal = localStorage.getItem('currentPortal');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (storedUser && isLoggedIn === 'true') {
      return {
        currentUser: JSON.parse(storedUser),
        isAuthenticated: true,
        authChecked: true,
        loading: false,
        error: null,
        portal: storedPortal,
      };
    }
  } catch (e) {
    // If parsing fails, return default state
  }
  
  return {
    currentUser: null,
    isAuthenticated: false,
    authChecked: false,
    loading: false,
    error: null,
    portal: null,
  };
};

const initialState = getInitialState();

export const login = createAsyncThunk(
  'auth/login',
  async ({ accessCode, password, portal, chain }, { rejectWithValue }) => {
    try {
      const response = await authService.login(accessCode, password, portal, chain);
      return { user: response.user, portal: response.portal };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    checkAuth: (state) => {
      const storedUser = localStorage.getItem('currentUser');
      const storedPortal = localStorage.getItem('currentPortal');
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      
      if (storedUser && isLoggedIn === 'true') {
        try {
          state.currentUser = JSON.parse(storedUser);
          state.isAuthenticated = true;
          state.portal = storedPortal;
        } catch (e) {
          state.currentUser = null;
          state.isAuthenticated = false;
          state.portal = null;
        }
      }
      state.authChecked = true;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateCurrentUser: (state, action) => {
      // Update specific fields of the current user
      if (state.currentUser) {
        state.currentUser = { ...state.currentUser, ...action.payload };
        localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.isAuthenticated = true;
        state.authChecked = true;
        state.portal = action.payload.portal;
        localStorage.setItem('currentUser', JSON.stringify(action.payload.user));
        localStorage.setItem('currentPortal', action.payload.portal);
        localStorage.setItem('isLoggedIn', 'true');
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.currentUser = null;
        state.isAuthenticated = false;
        state.portal = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentPortal');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('sessionToken');
      });
  },
});

export const { checkAuth, clearError, updateCurrentUser } = authSlice.actions;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectCurrentUser = (state) => state.auth.currentUser;
export const selectCurrentPortal = (state) => state.auth.portal;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectAuthChecked = (state) => state.auth.authChecked;
export default authSlice.reducer;
