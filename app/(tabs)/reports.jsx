import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { PieChart } from 'react-native-gifted-charts';
import { TOP_MARGIN } from '../../lib/constants';
import { exportToExcel } from '../../lib/exportUtils';

const screenWidth = Dimensions.get('window').width;

export default function Reports() {
  const [expenses, setExpenses] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [categories, setCategories] = useState({});
  const [selectedView, setSelectedView] = useState('month');
  const [selectedType, setSelectedType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [travelYearTotal, setTravelYearTotal] = useState(0);
  const [travelAllTimeTotal, setTravelAllTimeTotal] = useState(0);
  const [travelTripCount, setTravelTripCount] = useState(0);
  const [onetimeYearTotal, setOnetimeYearTotal] = useState(0);
  const [onetimeAllTimeTotal, setOnetimeAllTimeTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    const { data: cats } = await supabase.from('categories').select('*');
    if (cats) {
      const catMap = {};
      cats.forEach(c => catMap[c.id] = c);
      setCategories(catMap);
      setCategoriesList(cats);
    }

    const { data: exp } = await supabase
      .from('expenses')
      .select('*, returns(return_amount)')
      .order('expense_date', { ascending: false });
    if (exp) setExpenses(exp);

    const now = new Date();
    const year = now.getFullYear();

    // Travel — this year
    const { data: tripsYear } = await supabase
      .from('trips')
      .select('id, travel_expenses(amount, travel_returns(return_amount))')
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`);
    if (tripsYear) {
      const total = tripsYear.reduce((sum, trip) =>
        sum + (trip.travel_expenses || []).reduce((s, e) => {
        const returned = (e.travel_returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
        return s + parseFloat(e.amount) - returned;
      }, 0), 0);
      setTravelYearTotal(total);
      setTravelTripCount(tripsYear.length);
    }

    // Travel — all time
    const { data: tripsAll } = await supabase
      .from('trips')
      .select('id, travel_expenses(amount, travel_returns(return_amount))')
    if (tripsAll) {
      const total = tripsAll.reduce((sum, trip) =>
        sum + (trip.travel_expenses || []).reduce((s, e) => {
        const returned = (e.travel_returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
        return s + parseFloat(e.amount) - returned;
      }, 0), 0);
      setTravelAllTimeTotal(total);
    }

    // One-time — this year
    const { data: onetimeYear } = await supabase
      .from('onetime_expenses')
      .select('amount, onetime_returns(return_amount)')
      .eq('year', year);
    if (onetimeYear) {
      setOnetimeYearTotal(onetimeYear.reduce((sum, e) => {
        const returned = (e.onetime_returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
        return sum + parseFloat(e.amount) - returned;
      }, 0));
    }

    // One-time — all time
    const { data: onetimeAll } = await supabase
      .from('onetime_expenses')
      .select('amount, onetime_returns(return_amount)')
    if (onetimeAll) {
      setOnetimeAllTimeTotal(onetimeAll.reduce((sum, e) => {
        const returned = (e.onetime_returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
        return sum + parseFloat(e.amount) - returned;
      }, 0));
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = `${now.getFullYear()}`;

  const filteredExpenses = expenses.filter(e => {
    const timeMatch =
      selectedView === 'month' ? e.expense_date?.startsWith(currentMonth) :
      selectedView === 'year' ? e.expense_date?.startsWith(currentYear) :
      true;
    const typeMatch =
      selectedType === 'personal' ? !e.is_shared :
      selectedType === 'shared' ? e.is_shared :
      true;
    return timeMatch && typeMatch;
  });

  const total = filteredExpenses.reduce((sum, e) => {
    const returned = (e.returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
    return sum + parseFloat(e.amount) - returned;
  }, 0);
  const personalTotal = filteredExpenses.filter(e => !e.is_shared).reduce((sum, e) => {
    const returned = (e.returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
    return sum + parseFloat(e.amount) - returned;
  }, 0);
  const sharedTotal = filteredExpenses.filter(e => e.is_shared).reduce((sum, e) => {
    const returned = (e.returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
    return sum + parseFloat(e.amount) - returned;
  }, 0);

  const extraTravel = selectedView === 'year' ? travelYearTotal : selectedView === 'all' ? travelAllTimeTotal : 0;
  const extraOnetime = selectedView === 'year' ? onetimeYearTotal : selectedView === 'all' ? onetimeAllTimeTotal : 0;
  const grandTotal = total + extraTravel + extraOnetime;

  const categoryTotals = {};
  filteredExpenses.forEach(e => {
    if (!categoryTotals[e.category_id]) categoryTotals[e.category_id] = 0;
    const returned = (e.returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
    categoryTotals[e.category_id] += parseFloat(e.amount) - returned;
  });

  const pieData = Object.entries(categoryTotals).map(([catId, amount]) => {
    const cat = categories[catId];
    return {
      value: amount,
      color: cat?.color || '#B0B0B0',
      text: cat?.icon || '📦',
      label: cat?.name || 'Other',
    };
  }).sort((a, b) => b.value - a.value);

  const monthlyTotals = {};
  if (selectedView === 'year') {
    expenses
      .filter(e => {
        const timeMatch = e.expense_date?.startsWith(currentYear);
        const typeMatch =
          selectedType === 'personal' ? !e.is_shared :
          selectedType === 'shared' ? e.is_shared :
          true;
        return timeMatch && typeMatch;
      })
      .forEach(e => {
        const month = e.expense_date?.slice(0, 7);
        if (!monthlyTotals[month]) monthlyTotals[month] = 0;
        const returned = (e.returns || []).reduce((r, ret) => r + parseFloat(ret.return_amount), 0);
        monthlyTotals[month] += parseFloat(e.amount) - returned;
      });
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const timePeriodLabel =
    selectedView === 'month' ? `${now.toLocaleString('default', { month: 'long' })}_${currentYear}` :
    selectedView === 'year' ? currentYear : 'All_Time';

  const timePeriodDisplay =
    selectedView === 'month' ? 'This Month' :
    selectedView === 'year' ? 'This Year' : 'All Time';

  const typeLabel =
    selectedType === 'personal' ? 'Personal' :
    selectedType === 'shared' ? 'Shared' : 'All';

  const exportExpenses = expenses.filter(e => {
    if (selectedView === 'month') return e.expense_date?.startsWith(currentMonth);
    if (selectedView === 'year') return e.expense_date?.startsWith(currentYear);
    return true;
  });

  async function handleExport() {
    if (exportExpenses.length === 0) {
      Alert.alert('Nothing to export', 'No expenses found for this period.');
      return;
    }
    setExporting(true);
    try {
      await exportToExcel({
        expenses: exportExpenses,
        categories: categoriesList,
        period: selectedView,
        periodLabel: timePeriodLabel,
      });
    } catch (err) {
      Alert.alert('Export failed', err.message);
    }
    setExporting(false);
  }

  async function handleDeleteYear() {
    if (selectedView !== 'year') {
      Alert.alert('Info', 'Switch to "This Year" view to delete yearly data.');
      return;
    }
    Alert.alert(
      `Delete ${currentYear} Data`,
      `This will permanently delete ALL ${currentYear} expenses. Make sure you've exported first!\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${currentYear}`, style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('expenses')
              .delete()
              .gte('expense_date', `${currentYear}-01-01`)
              .lte('expense_date', `${currentYear}-12-31`);
            if (error) Alert.alert('Error', error.message);
            else { Alert.alert('Done', `All ${currentYear} expenses deleted.`); fetchData(); }
          }
        }
      ]
    );
  }

  const showExtras = (selectedView === 'year' || selectedView === 'all') && (extraTravel > 0 || extraOnetime > 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Reports 📊</Text>

      <Text style={styles.filterLabel}>Time Period</Text>
      <View style={styles.filterRow}>
        {[
          { key: 'month', label: 'This Month' },
          { key: 'year', label: 'This Year' },
          { key: 'all', label: 'All Time' },
        ].map(v => (
          <TouchableOpacity
            key={v.key}
            style={[styles.filterBtn, selectedView === v.key && styles.filterBtnActive]}
            onPress={() => setSelectedView(v.key)}
          >
            <Text style={[styles.filterText, selectedView === v.key && styles.filterTextActive]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterLabel}>Expense Type</Text>
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: '🔀 All' },
          { key: 'personal', label: '👤 Personal' },
          { key: 'shared', label: '👨‍👩‍👧 Shared' },
        ].map(v => (
          <TouchableOpacity
            key={v.key}
            style={[styles.filterBtn, selectedType === v.key && styles.filterBtnActive]}
            onPress={() => setSelectedType(v.key)}
          >
            <Text style={[styles.filterText, selectedType === v.key && styles.filterTextActive]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{timePeriodDisplay} · {typeLabel}</Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
        <Text style={styles.totalSub}>{filteredExpenses.length} transactions</Text>

        {selectedType === 'all' && (
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>👤 Personal</Text>
              <Text style={styles.breakdownAmount}>${personalTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>👨‍👩‍👧 Shared</Text>
              <Text style={styles.breakdownAmount}>${sharedTotal.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Travel + One-time additions */}
        {showExtras && (
          <View style={styles.extrasRow}>
            {extraTravel > 0 && (
              <Text style={styles.extraLine}>✈️ Travel: ${extraTravel.toFixed(2)}</Text>
            )}
            {extraOnetime > 0 && (
              <Text style={styles.extraLine}>📅 One-Time: ${extraOnetime.toFixed(2)}</Text>
            )}
            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalAmount}>${grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Export & Delete */}
      <View style={styles.exportCard}>
        <Text style={styles.exportTitle}>Export Data</Text>
        <Text style={styles.exportSub}>
          Exports ALL expenses for {timePeriodDisplay} as Excel
        </Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          <Text style={styles.exportBtnText}>
            {exporting ? '⏳ Exporting...' : `📥 Export ${timePeriodDisplay} to Excel`}
          </Text>
        </TouchableOpacity>
        {selectedView === 'year' && (
          <TouchableOpacity style={styles.deleteYearBtn} onPress={handleDeleteYear}>
            <Text style={styles.deleteYearBtnText}>🗑️ Delete {currentYear} data after export</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pie Chart */}
      {pieData.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={pieData}
              donut
              radius={100}
              innerRadius={60}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' }}>
                    ${total.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#666' }}>{typeLabel}</Text>
                </View>
              )}
            />
          </View>
          <View style={styles.legend}>
            {pieData.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.text} {item.label}</Text>
                <Text style={styles.legendAmount}>${item.value.toFixed(2)}</Text>
                <Text style={styles.legendPercent}>
                  {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data for this period</Text>
        </View>
      )}

      {/* Monthly Breakdown */}
      {selectedView === 'year' && Object.keys(monthlyTotals).length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Monthly Breakdown · {typeLabel}</Text>
          {Object.entries(monthlyTotals)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => {
              const monthIndex = parseInt(month.split('-')[1]) - 1;
              const maxVal = Math.max(...Object.values(monthlyTotals));
              const barWidth = maxVal > 0 ? (amount / maxVal) * (screenWidth - 200) : 0;
              return (
                <View key={month} style={styles.barRow}>
                  <Text style={styles.barLabel}>{monthNames[monthIndex]}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: barWidth }]} />
                  </View>
                  <Text style={styles.barAmount}>${amount.toFixed(0)}</Text>
                </View>
              );
            })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginTop: TOP_MARGIN, marginHorizontal: 16, marginBottom: 12 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#999', marginHorizontal: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 12 },
  filterBtn: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  filterText: { fontSize: 11, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  totalCard: { backgroundColor: '#4f46e5', margin: 16, borderRadius: 20, padding: 24, alignItems: 'center' },
  totalLabel: { color: '#c7d2fe', fontSize: 13, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 42, fontWeight: 'bold' },
  totalSub: { color: '#c7d2fe', fontSize: 12, marginTop: 4 },
  breakdownRow: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', width: '100%' },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  breakdownLabel: { color: '#c7d2fe', fontSize: 12, marginBottom: 4 },
  breakdownAmount: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  extrasRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', width: '100%', alignItems: 'center', gap: 4 },
  extraLine: { color: '#c7d2fe', fontSize: 13 },
  grandTotalLine: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  grandTotalLabel: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  grandTotalAmount: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  exportCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 20, padding: 16, marginBottom: 16 },
  exportTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  exportSub: { fontSize: 12, color: '#999', marginBottom: 12 },
  exportBtn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  deleteYearBtn: { borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 12, padding: 14, alignItems: 'center' },
  deleteYearBtnText: { color: '#FF6B6B', fontWeight: '600', fontSize: 14 },
  chartCard: { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  pieContainer: { alignItems: 'center', marginBottom: 16 },
  legend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { flex: 1, fontSize: 13, color: '#444' },
  legendAmount: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  legendPercent: { fontSize: 12, color: '#999', width: 35, textAlign: 'right' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barLabel: { width: 30, fontSize: 12, color: '#666' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#f0f4ff', borderRadius: 4 },
  barFill: { height: 8, backgroundColor: '#4f46e5', borderRadius: 4 },
  barAmount: { width: 55, fontSize: 12, color: '#444', textAlign: 'right' }
});