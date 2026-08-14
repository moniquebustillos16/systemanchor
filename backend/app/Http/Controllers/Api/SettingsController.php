<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    /**
     * GET /api/settings
     * Returns the single company settings row (creates defaults if none exist).
     */
    public function show()
    {
        $settings = CompanySetting::with('defaultWarehouse')->first();

        if (!$settings) {
            $settings = CompanySetting::create([
                'company_name'         => 'System Anchor Logistics Inc.',
                'trading_name'         => 'System Anchor WMS',
                'tin'                  => null,
                'industry'             => 'Warehousing & Logistics',
                'street_address'       => null,
                'city'                 => 'Naga City',
                'province'             => 'Camarines Sur',
                'region'               => 'Region V — Bicol',
                'zip_code'             => '4400',
                'country'              => 'Philippines',
                'landmark'             => null,
                'phone'                => null,
                'email'                => null,
                'website'              => null,
                'timezone'             => 'Asia/Manila',
                'currency'             => 'PHP',
                'date_format'          => 'YYYY-MM-DD',
                'language'             => 'English',
                'default_warehouse_id' => null,
                'fiscal_year_start'    => 'January',
                'low_stock_threshold'  => 15,
                'auto_reorder'         => 'disabled',
            ]);
            $settings->load('defaultWarehouse');
        }

        return response()->json(['data' => $settings]);
    }

    /**
     * PUT / PATCH /api/settings
     * Updates the single company settings row.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'company_name'         => 'sometimes|required|string|max:255',
            'trading_name'         => 'nullable|string|max:255',
            'tin'                  => 'nullable|string|max:50',
            'industry'             => 'nullable|string|max:100',
            'street_address'       => 'nullable|string|max:255',
            'city'                 => 'nullable|string|max:100',
            'province'             => 'nullable|string|max:100',
            'region'               => 'nullable|string|max:100',
            'zip_code'             => 'nullable|string|max:20',
            'country'              => 'nullable|string|max:100',
            'landmark'             => 'nullable|string|max:255',
            'phone'                => 'nullable|string|max:50',
            'email'                => 'nullable|email|max:255',
            'website'              => 'nullable|string|max:255',
            'timezone'             => 'nullable|string|max:80',
            'currency'             => 'nullable|string|max:10',
            'date_format'          => ['nullable', 'string', 'max:20', Rule::in(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'])],
            'language'             => 'nullable|string|max:50',
            'default_warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'fiscal_year_start'    => ['nullable', 'string', 'max:20', Rule::in(['January', 'July'])],
            'low_stock_threshold'  => 'nullable|numeric|min:0',
            'auto_reorder'         => ['nullable', 'string', 'max:50', Rule::in(['disabled', 'draft_po'])],
        ]);

        $settings = CompanySetting::first();

        if (!$settings) {
            $settings = CompanySetting::create(array_merge([
                'company_name' => 'System Anchor Logistics Inc.',
            ], $validated));
        } else {
            $settings->update($validated);
        }

        $settings->load('defaultWarehouse');

        return response()->json([
            'message' => 'Settings updated successfully',
            'data'    => $settings,
        ]);
    }
}