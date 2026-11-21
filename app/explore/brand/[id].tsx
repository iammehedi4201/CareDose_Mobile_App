import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheet,
  EmptyState,
  ErrorState,
  FormField,
  LoadingSkeleton,
  MedicineCard,
  PrimaryButton,
  ScreenContainer,
  StatusBadge,
  SuccessToast,
  validateRequiredFields,
} from '../../../src/components';
import { resolveDosageFormIcon } from '../../../src/components/MedicineCard';
import {
  AlternativeGroupWithCandidatesDto,
  CatalogueBrandDetailDto,
  getCatalogueBrandAlternatives,
  getCatalogueBrandDetail,
} from '../../../src/api/catalogue';
import {
  formatCurrencyAmount,
  formatMissingCatalogueValue,
  formatPackSummary,
  formatPackWarningReason,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
} from '../../../src/features/catalogue/catalogue-helpers';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../../../src/theme/tokens';

export default function CatalogueBrandDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [brand, setBrand] = useState<CatalogueBrandDetailDto | null>(null);
  const [altGroups, setAltGroups] = useState<AlternativeGroupWithCandidatesDto[]>([]);
  const [warningNotice, setWarningNotice] = useState(
    'Possible matches only. Always ask a doctor or pharmacist before changing brands.',
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [personalInstructions, setPersonalInstructions] = useState('');
  const [startingStock, setStartingStock] = useState('10');
  const [threshold, setThreshold] = useState('5');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadBrand = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const [detailRes, altRes] = await Promise.all([
        getCatalogueBrandDetail(id),
        getCatalogueBrandAlternatives(id),
      ]);
      setBrand(detailRes);
      setAltGroups(altRes.groups);
      setWarningNotice(altRes.warningNotice);
    } catch (err) {
      const fallback = OFFLINE_FALLBACK_CATALOGUE_BRANDS.find(
        (b) => b.sourceId === id || b.id === id,
      );
      if (fallback) {
        setBrand({
          ...fallback,
          productUrl: null,
          collectedAt: null,
          packs: fallback.primaryPack ? [fallback.primaryPack] : [],
          images: [],
          safetyNotice: 'Offline preview data. Start the CareDose backend to view live records.',
        });
        setAltGroups([]);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load medicine details.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadBrand();
  }, [loadBrand]);

  const handleAddToMyMedicines = (): void => {
    const errs = validateRequiredFields(
      { personalInstructions, startingStock, threshold },
      {
        personalInstructions: 'Personal instructions',
        startingStock: 'Starting stock',
        threshold: 'Low-stock threshold',
      },
    );
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !brand) return;

    setAddOpen(false);
    setPersonalInstructions('');
    setToast(`${brand.name} saved with personal instructions.`);
  };

  if (loading) {
    return (
      <ScreenContainer
        title="Medicine Details"
        subtitle="Loading catalogue record..."
        onBack={() => router.push('/explore')}
      >
        <LoadingSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  if (errorMessage || !brand) {
    return (
      <ScreenContainer
        title="Medicine Details"
        onBack={() => router.push('/explore')}
      >
        <ErrorState
          title="Could not load brand details"
          message={errorMessage ?? 'Brand record not found.'}
          onRetry={() => void loadBrand()}
        />
      </ScreenContainer>
    );
  }

  const badge = resolveBrandBadge(brand);
  const primaryImage = brand.images[0] ?? null;

  return (
    <ScreenContainer
      title={brand.name}
      subtitle={`${brand.strength ?? 'Strength: Not available'} · ${brand.dosageForm ?? 'Form: Not available'}`}
      onBack={() => router.push('/explore')}
    >
      <SuccessToast message={toast} />

      {/* Top Hero + Packaging Photo (only when real image exists) + Primary CTA */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          {primaryImage ? (
            <Image
              source={{ uri: primaryImage.imageUrl }}
              accessibilityLabel={`${brand.name} packaging`}
              style={styles.heroPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroIcon}>
              <Feather
                name={resolveDosageFormIcon(brand.dosageForm)}
                size={22}
                color={CAREDOSE_EXTENDED_COLORS.primary}
              />
            </View>
          )}
          <View style={styles.heroTextCol}>
            <Text style={styles.heroName}>{brand.name}</Text>
            <Text style={styles.heroMeta}>{formatMissingCatalogueValue(brand.manufacturer)}</Text>
          </View>
          <StatusBadge variant={badge.variant} label={badge.label} />
        </View>

        {primaryImage ? (
          <Text style={styles.imageNotice}>
            Photo source: {primaryImage.sourceName} · Unverified match · Permission unrecorded
          </Text>
        ) : null}

        <View style={styles.heroActionWrap}>
          <PrimaryButton
            fullWidth
            label="+ Add to My Medicines"
            onPress={() => setAddOpen(true)}
          />
        </View>
      </View>

      {/* Catalogue Details */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Medicine details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Generic</Text>
          {brand.generic ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
            >
              <Text style={styles.linkText}>{brand.generic.name}</Text>
            </Pressable>
          ) : (
            <Text style={styles.infoValue}>Not available</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Strength</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.strength)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dosage form</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.dosageForm)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Manufacturer</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.manufacturer)}</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Release marker</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.releaseMarker)}</Text>
        </View>
      </View>

      {/* Pack & Pricing Details */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Pack &amp; price ({brand.packs.length})</Text>
          <StatusBadge
            variant={brand.hasPriceWarning ? 'low_stock' : 'unverified'}
            label={brand.hasPriceWarning ? 'Price warning' : 'Unverified'}
          />
        </View>

        {brand.packs.length === 0 ? (
          <Text style={styles.supportingEmpty}>No pack pricing records available in catalogue.</Text>
        ) : (
          brand.packs.map((pack, idx) => (
            <View
              key={pack.id}
              style={[
                styles.packBlock,
                idx === brand.packs.length - 1 ? styles.lastPackBlock : null,
              ]}
            >
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pack size</Text>
                <Text style={styles.infoValue}>{formatPackSummary(pack)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pack price</Text>
                <Text style={styles.infoValue}>
                  {formatCurrencyAmount(pack.packPrice, pack.currency)}
                </Text>
              </View>
              <View style={[styles.infoRow, pack.warnings.length === 0 ? styles.lastRow : null]}>
                <Text style={styles.infoLabel}>Unit price</Text>
                <Text style={styles.infoValue}>
                  {pack.unitPrice ? formatCurrencyAmount(pack.unitPrice, pack.currency) : 'Not available'}
                </Text>
              </View>
              {pack.warnings.length > 0 ? (
                <View style={styles.packWarningRow}>
                  <Feather name="alert-triangle" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
                  <Text style={styles.packWarningText}>
                    {pack.warnings.map(formatPackWarningReason).join(' ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Potential Matching Brands */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Potential matching brands</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/alternatives')}
        >
          <Text style={styles.linkText}>Compare all</Text>
        </Pressable>
      </View>

      {altGroups.length === 0 || altGroups.every((g) => g.candidateBrands.length === 0) ? (
        <EmptyState
          title="No matching brands listed"
          description="No other imported catalogue brands share the same generic, strength, and dosage form."
        />
      ) : (
        altGroups.map((group) => (
          <View key={group.id} style={styles.altGroupWrap}>
            {group.isCombination ? (
              <Text style={styles.comboNote}>
                Combination product · {group.strengthNorm} · {group.dosageFormNorm}
              </Text>
            ) : null}
            {group.candidateBrands.map((alt) => {
              const altBadge = resolveBrandBadge(alt);
              return (
                <MedicineCard
                  key={alt.id}
                  name={alt.name}
                  genericName={alt.generic?.name}
                  strength={alt.strength}
                  dosageForm={alt.dosageForm}
                  manufacturer={alt.manufacturer ?? 'Not available'}
                  stockText={formatUnitOrPackPrice(alt.primaryPack)}
                  priceText={formatPackSummary(alt.primaryPack)}
                  statusVariant={altBadge.variant}
                  statusLabel={altBadge.label}
                  onPress={() => router.push(`/explore/brand/${alt.sourceId}`)}
                />
              );
            })}
          </View>
        ))
      )}

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>{warningNotice}</Text>
      </View>

      <BottomSheet
        visible={addOpen}
        title="Add to My Medicines"
        subtitle={`${brand.name} · ${brand.dosageForm ?? 'Medicine'}`}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddToMyMedicines}
        submitLabel="Add medicine"
      >
        <FormField
          label="Personal instructions"
          value={personalInstructions}
          onChangeText={setPersonalInstructions}
          placeholder="Enter as prescribed"
          required
          errorMessage={errors.personalInstructions}
          helperText="Does not auto-create a schedule."
        />
        <FormField
          label="Starting stock"
          value={startingStock}
          onChangeText={setStartingStock}
          keyboardType="numeric"
          required
          errorMessage={errors.startingStock}
        />
        <FormField
          label="Low-stock threshold"
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
          required
          errorMessage={errors.threshold}
        />
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  heroPhoto: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  heroTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  heroMeta: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  imageNotice: {
    marginTop: 8,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  heroActionWrap: {
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 4,
  },
  supportingEmpty: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    paddingVertical: 6,
  },
  packBlock: {
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  lastPackBlock: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  packWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  packWarningText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
    gap: 12,
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    flexShrink: 0,
    maxWidth: '46%',
  },
  infoValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    textAlign: 'right',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  altGroupWrap: {
    marginBottom: 4,
  },
  comboNote: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginBottom: 6,
  },
  warningBox: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
    lineHeight: 16,
  },
});
