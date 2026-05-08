import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { staffService } from '../../services/staffService';

const initialState = {
  staff: [],
  loading: false,
  error: null,
};

export const fetchStaff = createAsyncThunk(
  'staff/fetchAll',
  async ({ role, chain } = {}, { rejectWithValue }) => {
    try {
      return await staffService.getStaff(role || null, chain || null);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createStaff = createAsyncThunk(
  'staff/create',
  async (staffData, { rejectWithValue }) => {
    try {
      return await staffService.createStaff(staffData);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateStaff = createAsyncThunk(
  'staff/update',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      return await staffService.updateStaff(id, updates);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteStaff = createAsyncThunk(
  'staff/delete',
  async (id, { rejectWithValue }) => {
    try {
      await staffService.deleteStaff(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const staffSlice = createSlice({
  name: 'staff',
  initialState,
  reducers: {
    clearStaffError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStaff.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchStaff.fulfilled, (state, action) => {
        state.loading = false;
        state.staff = action.payload;
      })
      .addCase(fetchStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createStaff.fulfilled, (state, action) => {
        state.staff.push(action.payload);
      })
      .addCase(updateStaff.fulfilled, (state, action) => {
        const index = state.staff.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.staff[index] = action.payload;
        }
      })
      .addCase(deleteStaff.fulfilled, (state, action) => {
        state.staff = state.staff.filter(s => s.id !== action.payload);
      });
  },
});

export const { clearStaffError } = staffSlice.actions;
export const selectStaff = (state) => state.staff.staff;
export const selectStaffLoading = (state) => state.staff.loading;
export default staffSlice.reducer;
