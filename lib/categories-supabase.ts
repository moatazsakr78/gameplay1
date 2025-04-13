// راجع التعليمات في ملف README.md لإضافة وظائف الفئات

import { supabase, isOnline, saveData } from './supabase';

// وظائف التعامل مع الفئات
export async function saveCategoriestoSupabase(categories: any[]) {
  try {
    if (!isOnline()) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('بدء حفظ الفئات في Supabase...');
    
    // حذف جميع الفئات الحالية أولاً
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .not('id', 'is', null);
    
    if (deleteError) {
      console.error('خطأ في حذف الفئات:', deleteError);
      throw deleteError;
    }
    
    // تنظيف البيانات قبل الحفظ
    const uniqueCategories = categories.filter((c, index, self) => 
      index === self.findIndex(t => t.id === c.id)
    );
    
    // إعادة تنسيق البيانات للتأكد من توافقها
    const serializedCategories = uniqueCategories.map(category => ({
      ...category,
      // تحويل صورة إلى نص إذا لزم الأمر
      image: typeof category.image === 'object' ? JSON.stringify(category.image) : category.image
    }));
    
    // إضافة الفئات
    const { data, error } = await supabase
      .from('categories')
      .insert(serializedCategories)
      .select();
    
    if (error) {
      console.error('خطأ في حفظ الفئات:', error);
      throw error;
    }
    
    console.log('تم حفظ الفئات بنجاح في Supabase:', serializedCategories.length);
    
    return data;
  } catch (error) {
    console.error('خطأ في saveCategoriestoSupabase:', error);
    throw error;
  }
}

export async function loadCategoriesFromSupabase() {
  try {
    if (!isOnline()) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('جاري تحميل الفئات من Supabase...');
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('خطأ في تحميل الفئات من Supabase:', error);
      throw error;
    }
    
    // التحقق من وجود بيانات
    if (!data || data.length === 0) {
      console.log('لا توجد فئات في Supabase');
      return null;
    }
    
    console.log('تم تحميل الفئات بنجاح من Supabase:', data.length);
    
    return data;
  } catch (error) {
    console.error('خطأ في loadCategoriesFromSupabase:', error);
    throw error;
  }
}

// دالة فعالة للمزامنة مع قاعدة البيانات
export async function syncCategoriesFromSupabase(force = false) {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن مزامنة الفئات.');
    return null;
  }
  
  try {
    console.log('بدء مزامنة الفئات...');
    
    // تحميل البيانات من السيرفر أولاً
    console.log('محاولة تحميل الفئات من السيرفر...');
    let serverData = null;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log('تم العثور على الفئات في السيرفر:', data.length);
        serverData = data;
      } else {
        console.log('لم يتم العثور على فئات في السيرفر');
      }
    } catch (error) {
      console.error('خطأ في جلب الفئات من السيرفر:', error);
    }
    
    // تحميل البيانات المحلية
    let localData = [];
    try {
      const storedData = localStorage.getItem('categories');
      if (storedData) {
        localData = JSON.parse(storedData);
        console.log('تم تحميل الفئات المحلية:', localData.length);
      }
    } catch (error) {
      console.error('خطأ في تحميل الفئات المحلية:', error);
    }
    
    // إذا وجدنا بيانات على السيرفر، استخدمها وحدّث البيانات المحلية
    if (serverData) {
      console.log('استخدام فئات السيرفر وتحديث التخزين المحلي');
      
      // تحديث البيانات المحلية
      localStorage.setItem('categories', JSON.stringify(serverData));
      try {
        saveData('categories', serverData);
      } catch (e) {
        console.error('خطأ في حفظ الفئات في التخزين الدائم:', e);
      }
      
      // إعلام التطبيق بالتغييرات
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'categories', timestamp: Date.now(), source: 'server' }
        }));
      }
      
      return serverData;
    } 
    // إذا لم نجد بيانات على السيرفر ولكن لدينا بيانات محلية، ارفعها إلى السيرفر
    else if (localData.length > 0) {
      console.log('لم يتم العثور على فئات في السيرفر. رفع الفئات المحلية...');
      
      try {
        // حذف أي بيانات موجودة في السيرفر
        await supabase.from('categories').delete().not('id', 'is', null);
        
        // تنظيف البيانات
        const uniqueCategories = localData.filter((c: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === c.id)
        );
        
        // تأكد من أن جميع البيانات بالتنسيق الصحيح
        const formattedCategories = uniqueCategories.map((category: any) => ({
          ...category,
          image: typeof category.image === 'object' ? JSON.stringify(category.image) : category.image
        }));
        
        // رفع البيانات المحلية
        const { data, error } = await supabase
          .from('categories')
          .insert(formattedCategories)
          .select();
        
        if (error) {
          throw error;
        }
        
        console.log('تم رفع الفئات المحلية بنجاح:', data.length);
        
        return formattedCategories;
      } catch (error) {
        console.error('خطأ في رفع الفئات المحلية إلى السيرفر:', error);
        throw error;
      }
    }
    
    // لا توجد بيانات في أي مكان
    console.log('لا توجد فئات محلية أو على السيرفر');
    return null;
  } catch (error) {
    console.error('خطأ في syncCategoriesFromSupabase:', error);
    throw error;
  }
}

// إجبار تحديث الفئات من السيرفر
export async function forceRefreshCategoriesFromServer() {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن تحديث الفئات.');
    return null;
  }
  
  try {
    console.log('إجبار تحديث الفئات من السيرفر...');
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد فئات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل الفئات بنجاح من السيرفر:', data.length);
    
    // تحديث البيانات المحلية
    localStorage.setItem('categories', JSON.stringify(data));
    try {
      saveData('categories', data);
    } catch (e) {
      console.error('خطأ في حفظ الفئات في التخزين الدائم:', e);
    }
    
    // إعلام التطبيق بالتغييرات
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('customStorageChange', { 
        detail: { type: 'categories', timestamp: Date.now(), source: 'server' }
      }));
    }
    
    return data;
  } catch (error) {
    console.error('خطأ في forceRefreshCategoriesFromServer:', error);
    throw error;
  }
}
