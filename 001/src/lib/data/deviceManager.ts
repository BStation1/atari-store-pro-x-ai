/**
 * Unified Device Manager Data Access Layer
 * @license Apache-2.0
 */

import { DBDeviceType, DBDeviceModel, RepairTemplateItem } from '../../types';
import {
  fetchDeviceTypesFromSupabase,
  addDeviceTypeToSupabase,
  updateDeviceTypeInSupabase,
  deleteDeviceTypeInSupabase,
  getDeviceTypesSync,
  fetchDeviceModelsFromSupabase,
  addDeviceModelToSupabase,
  updateDeviceModelInSupabase,
  deleteDeviceModelInSupabase,
  getDeviceModelsSync,
  fetchRepairTemplatesFromSupabase,
  addRepairTemplateToSupabase,
  updateRepairTemplateInSupabase,
  deleteRepairTemplateInSupabase,
  getRepairTemplatesSync
} from '../supabaseDeviceManager';

export {
  fetchDeviceTypesFromSupabase,
  addDeviceTypeToSupabase,
  updateDeviceTypeInSupabase,
  deleteDeviceTypeInSupabase,
  getDeviceTypesSync,
  fetchDeviceModelsFromSupabase,
  addDeviceModelToSupabase,
  updateDeviceModelInSupabase,
  deleteDeviceModelInSupabase,
  getDeviceModelsSync,
  fetchRepairTemplatesFromSupabase,
  addRepairTemplateToSupabase,
  updateRepairTemplateInSupabase,
  deleteRepairTemplateInSupabase,
  getRepairTemplatesSync
};
