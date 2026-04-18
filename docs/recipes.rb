require 'json'
require 'set'
require 'statics'

class Recipes

  attr_reader :shops

  def initialize
    @objects = JSON.parse(File.read("resources/Objects.json"))

    @objects.merge!(JSON.parse(File.read("resources/Mannequins.json")))
    @objects_big = JSON.parse(File.read("resources/BigCraftables.json"))
    @str_objects = JSON.parse(File.read("resources/Strings/Objects.json"))
    # format id qty
    @recipes = JSON.parse(File.read("resources/CraftingRecipes.json"))
    @recipes["Oil of Garlic"] = @recipes['Oil Of Garlic'].dup
    @recipes.delete('Oil Of Garlic')
    @shop_data = JSON.parse(File.read("resources/Shops.json"))
    @cooking = JSON.parse(File.read("resources/CookingRecipes.json"))
    @categories = {}
  end

  def shop_name(value)
    result = SHOP_NAMES[value] || value
    result = result.sub("_", " ")
    result
  end

  def process_shops
    debug = true
    # ignoring Festival_FeastOfTheWinterStar_Pierre. too pricy anyway only 1 item per go
    ignore = ["AdventureGuildRecovery", "BooksellerTrade", "RetroFurnitureCatalogue", "Festival_FeastOfTheWinterStar_Pierre",
              "JojaFurnitureCatalogue", "JunimoFurnitureCatalogue", "LostItems", "PetAdoption", "WizardFurnitureCatalogue",
              "TrashFurnitureCatalogue", "Joja", "HatMouse", "Furniture Catalogue", "Festival Luau_Pierre",
              "Festival DanceOfTheMoonlightJellies_Pierre" ]
    ignore_objects = ["(O)897", "(O)858", "(O)911"]
    double_price = ["Saloon", "Sandy"]
    # item id with the shop + price on buying it.
    result = {}
    # currencies
    # 0 = Gold
    # 4 = Qi Gems
    @shop_data.each do |internal_name, shop|
      next if ignore.include? internal_name
      next if internal_name.start_with? "DesertFestival"
      name = shop_name(internal_name)
      puts "*" * 80 if debug
      puts "Shop : #{name}" if debug
      puts "*" * 80 if debug
      shop['Items'].each do |item|
        # skip recipe
        next if item['IsRecipe']
        item_id = item['ItemId']
        if item_id.nil?
          # random in stock
          item_ids = item['RandomItemId']
          item_ids&.each do |rnd_id|
            rnd_object = lookup_item(rnd_id)
            next if rnd_object.nil? #(eg furniture etc)
            puts "#{rnd_object['Name']}=#{rnd_id}=#{item['Price']},rnd=true" if debug
            min_stack = item['MinStack']
            min_stack =1 if min_stack == -1
            (result[rnd_id] ||= []) << [name, item["Price"], min_stack, rnd_object["Name"]]
          end
          next
        end
        puts item_id
        if ignore_objects.include? item_id
          next
        end
        object = lookup_item(item_id)
        if object.nil?
          puts "Not an object #{item_id}" if debug
          next
        end
        if !object["ContextTags"].nil? && object["ContextTags"].include?("ring_item")
          puts "Skipping : #{name} with itemId #{item_id}" if debug
          next
        end
        # price = item["TradeItemId"].nil? ? item['Price'] : item["Price"] == 0 ? object["Price"] : object["Price"]
        item_price = item["Price"] != -1 ? item["Price"] : item["TradeItemAmount"]
        item_price = object["Price"] if item_price == 1
        # sell price saloon is double. Have not found how to determine that based on config.
        # for now : if price is not and there is a shop, double it, to prevent doubling things that should not be doubled
        # rhubarb doesn't have a price and has useObjetDataPrice set to false, so added check for price being -1
        item_price = item_price * 2 if double_price.include?(name) && (item['UseObjectDataPrice'] || (!item['UseObjectDataPrice'] &&  item['Price'] == -1))
        min_stack = item['MinStack']
        min_stack =1 if min_stack == -1
        if internal_name == 'Carpenter'
          case object["Name"]
            # https://stardewvalleywiki.com/Wood
          when 'Wood'
            item_price = 50
          when 'Stone'
            item_price = 100
          end
        end
        item_array = [name, item_price, min_stack, object["Name"]]#, false]
        item_array << lookup_item(item['TradeItemId'])["Name"] if item['TradeItemId']
        # MVDB (result[item_id] ||= []) << item_array
        (result[object["Name"]] ||= []) << item_array
        # take the second prize in the list for Clint (eg copper, iron, etc)
        if internal_name == 'Blacksmith' && (result[object["Name"]] ||= []).length == 2
          result[object["Name"]] = [result[object["Name"]].last]
        end
        puts "#{object['Name']}=#{item_id}=#{item['MinStack']}=#{item['MaxStack']}=#{item_price}=#{item['Price']}" if debug
      end
      puts "*" * 80 if debug
    end
    # export : result.to_json
    @shops = result
  end

  def process_all(parts)
    tmp1 = @objects.map{|id, obj| [obj["Name"], obj["Type"], obj["Category"], id, obj]}
    # 79 = secret note
    tmp1.delete_if { |a| NS_CATS.include?(a[2]) || a[1] == 'Ring' || a[1] == 'Litter' ||a[1] == 'Asdf' ||(a[1] == 'Quest' && !ALLOWED_QUESTS.include?(a[0]))|| a[3] == 79 }
    tmp1.delete_if { |a| a[0].nil?}
    # tmp1.sort_by! {|a| a[0]}
    @objects_big.delete_if { |id, obj| BC_IGNORE.include?( id) }
    tmp2 = @objects_big.map{|id, obj| [obj["Name"], obj["Type"], obj["Category"], "(BC)#{id}", obj]}
    # references and amounts to id so {"wood:" => {}|
    all = tmp1.map{|a| [match_category(a), a[0]]}
    all += tmp2.map{|a| ["Machines" , a[0]]}
    all = others(all, parts)
    all = correct(all)
    all
  end

  def correct(all)
    all.delete_if{ |a| REMOVE.include?(a[1]) }
    all = all.map{|a| [ITEM_CAT[a[1]] || a[0], a[1], DISPLAY_NAME[a[1]] ]}
    # mannequins
    all+=(MANNNEQUINS.map{|a| ["Decoration (Other)", a,] })
    all
  end


  def process_parts
    @objects.delete_if { |k, _| NS_IDS.include?(k) }
    result = {}
    all_recipes = @recipes.merge(@cooking)
    all_recipes.each do |name, recipe|
      # next unless name == "Transmute (Fe)"
      # puts name
      split = recipe.split('/')
      # items needed to create recipe
      parts = split[0].split(" ")
      target_split = split[2].split(" ")
      target_id = target_split.first
      target_quantity = target_split.length == 1 ? 1: target_split.last
      target = lookup_item(target_id, split[3])
      if target.nil?
        puts name
        puts recipe
      end
      next if target.nil?
      next if target['Type'] == "Ring"
      category = target["Category"]
      # puts category
      # puts name
      # bobber
      next if category == -22
      # it is a machine / craftable
      category = 1114 if category.nil?
      category = CATEGORY_MAP[category] || category
      (@categories[category] ||= []) << name
      item = Item.new(target_id, name, target_quantity, target, split[3])
      result[name] = item
      parts.each_slice(2) do |id, qty|
        object = id.start_with?("-") ? ANIES[id] : lookup_item(id)
        next if object.nil?
        item.add_part(id, object['Name'], qty, object)
      end
      # puts recipe
    end
    result
  end

  def plural(base_word)
    word = base_word.dup
    if word.end_with?("y")
      word = word[0..-2] << "ies"
    elsif word.end_with?("Peach")
      word << "es"
    else
      word << "s" unless word.end_with?("s")
    end
    word
  end

  def add_part(parts, name, part_name, yields, part_qty)
    item = parts[name]
    item = Item.new(name, name, yields,  {"Name:" => name}) if item.nil?
    part_id, _ = lookup_id(part_name)
    item.add_part(part_id, part_name, part_qty)
    parts[name] = item
  end

  def others_resources(parts)
    ["Copper", "Iron", "Gold", "Iridium", "Radioactive"].each do |part|
      add_part(parts, "#{part} Bar", "#{part} Ore", 1, 5)
    end
    add_part(parts, "Wilted Bouquet", "Bouquet", 1, 1)
    add_part(parts, "Void Ghost Pendant", "Void Essence", 1, 200)
    add_part(parts, "Artifact Trove", "Omni Geode", 1, 5)
    add_part(parts, "Book of Mysteries", "Golden Mystery Box", 1, (100/0.96).ceil)
    add_part(parts, "Fossilized Skull", "Golden Coconut", 1, 7)
    add_part(parts, "Refined Quartz", "Fire Quartz", [15,20], 5)
  end

  def others_fish(all, parts)
    fish = all.select{|f| f[0] == 'Fish'}
    fish.delete_if{|f| [ "Nautilus Shell", "Green Algae", "White Algae", "Seaweed", "Cave Jelly", "River Jelly", "Sea Jelly", "Rainbow Shell", "Coral"].include?(f[1])}
    bait = fish.map{|f| ["Bait", "#{f[1]} Bait"]}
    #  1 fish youlds 5 to 10 bait
    fish.each{|f| add_part(parts, "#{f[1]} Bait", f[1], [5, 10], 1)}
    # fish.each{|f| add_part(parts, f[1], "#{f[1]} Bait", 1, [5, 10])}
    smoked = fish.map{|f| ["Smoked Fish", "Smoked #{f[1]}"]}
    fish.each{|f| add_part(parts, "Smoked #{f[1]}", f[1], 1, 1)}
    LEGENDS.each{|legend| fish << ["Fish", legend]}
    roe = fish.map{|f| ["Roe", "#{f[1]} Roe"]}
    roe.delete(["Roe", "Roe Roe"])
    roe << ["Roe", "Roe"]
    aged_roe = fish.map{|f| ["Aged Roe", "Aged #{f[1]} Roe"]}
    aged_roe.delete(["Aged Roe", "Aged Sturgeon Roe"])
    fish.delete_if{|f| f[1] == "Sturgeon"}
    fish.map{|f| add_part(parts, "Aged #{f[1]} Roe", "#{f[1]} Roe", 1, 1)}
    add_part(parts, "Caviar", "Sturgeon Roe", 1,1)
    (bait + roe + aged_roe + smoked)
  end

  def others_vegies(all, parts)
    vegies = all.select{|f| f[0] == 'Vegetables'}
    pickles = vegies.map{|f| ["Pickles", "Pickled #{f[1]}"]}
    vegies.each{|f| add_part(parts, "Pickled #{f[1]}", f[1],1,1)}
    # tea and beer
    ignore = ["Tea Leaves", "Wheat"]
    add_part(parts, "Green Tea", "Tea Leaves", 1, 1)
    add_part(parts, "Beer", "Wheat", 1, 1)
    juice = vegies.reject{|a| ignore.include?(a[1])}.map{|f| ["Juice", "#{f[1]} Juice"]}
    vegies.reject{|a| ignore.include?(a[1])}.each{|f| add_part(parts, "#{f[1]} Juice", f[1],1,1)}
    (pickles + juice)
  end
  def others_fruit(all, parts)

    fruit =  all.select{|f| f[0] == 'Fruits'}
    jellies = fruit.map{|f| ["Jelly", "#{f[1]} Jelly"]}
    fruit.each{|f| add_part(parts, "#{f[1]} Jelly",f[1], 1,1)}
    wine = fruit.map{|f| ["Wine", "#{f[1]} Wine"]}
    fruit.each{|f| add_part(parts, "#{f[1]} Wine",f[1], 1,1)}
    dried_fruit = fruit.map{|f|  [DRIED_CAT, "Dried #{plural(f[1])}"]}
    fruit.each{|f| !["Grape"].include?(f[1]) ? add_part(parts, "Dried #{plural(f[1])}", f[1], 1,5) : add_part(parts, "Raisins", f[1], 1, 5)}
    dried_fruit.delete_if{|f| f[1] == 'Dried Grapes'}
    dried_fruit << [DRIED_CAT, "Raisins"]
    (dried_fruit + wine + jellies)

  end

  def others_forage(all, parts)
    forage =  all.select{|f| f[0] == 'Forage'}
    mushrooms = ["Chanterelle", "Common Mushroom", "Magma Cap", "Morel", "Purple Mushroom"]
    forage.delete_if{|f| ["Sap", "Holly","Red Mushroom"].include?(f[1])}
    forage_pickles = forage.map{|f| ["Pickles", "Pickled #{f[1]}"]}
    forage.each{|f| add_part(parts, "Pickled #{f[1]}", f[1], 1,1) }
    forage.delete_if{|f| mushrooms.include?(f[1])}
    forage_juice = forage.map{|f| ["Juice", "#{f[1]} Juice"]}
    forage.each{|f| add_part(parts, "#{f[1]} Juice", f[1], 1,1) }
    dried_mush = mushrooms.map{|f| [DRIED_CAT, "Dried #{plural(f)}"]}
    mushrooms.each{|f| add_part(parts, "Dried #{plural(f)}", f, 1,5)}
    mushrooms = (mushrooms+["Red Mushroom"]).map{|f| ["Forage", f]}
    (mushrooms + dried_mush + forage_juice + forage_pickles)
  end
  def others_flowers(all, parts)
    flowers = all.select{|f| f[0] == 'Flowers'}
    flowers.delete_if{|f| ["Crocus", "Sweet Pea"].include?(f[1])}
    flowers_honey = (flowers+[[nil, "Wild"]]).map{|f| ["Artisan Goods (Other)", "#{f[1]} Honey"]}
    # example of creating a name mapping
    #blub = flowers.map{|f| "\"#{f[1]} Honey\" => \"Honey: #{f[1]}\""}.join("\n").to_s
    (flowers_honey)
  end

  def others(all, parts)
    all += others_fish(all, parts)
    all += others_vegies(all, parts)
    all += others_fruit(all, parts)
    all += others_forage(all, parts)
    all += others_flowers(all, parts)
    others_resources(parts)
    all
  end

  def match_category(record)
    types = {"Arch"=>"Artifacts"}
    result = CATEGORY_MAP[record[2]] || record[2]
    if record[2] == 0
      result = types[record[1]] || record[1]
    end
    result
  end

  def process_items(items)
    rows = []
    result = {}
    items.each do |name, item|
      item.parts.each do |part_id, part|
        item_qty = item.qty.is_a?(Array) ? (item.qty.sum.to_f / item.qty.length) : item.qty
        (result[part[0]] ||= [[part[0], 999]]) << [name, (part[1] * (999/item_qty))]
      end
    end
    result
  end

  def lookup_id(name)
    found = @objects.find {|_,o| o['Name'] == name}
    @objects_big.find {|_,o| o['Name'] == name} if found.nil?
    found
  end

  def lookup_item(id, big = false)
    # big == true is needed since it can be a string (eg cooking)
    if big == true.to_s || big == true || id.start_with?("(BC)")
      target = @objects_big[id.split("(BC)").last]
    elsif id.start_with?("(O)")
      target = @objects[id.split("(O)").last]
    elsif id.start_with?("FLAVORED_ITEM")
      #eg FLAVORED_ITEM Bait (O)129
      split = id.split(' ')
      item = lookup_item(split.last)
      item_name = split[1]+" "+item["Name"]
      target = { "Name" => item_name }
    end
    target = @objects[id] if target.nil?
    target
  end


  def lookup_item_self_big(object_id)
    id = object_id.start_with?("(BC)") ? object_id[4...] : object_id
    target = @objects_big[id]
    target = @objects[id] if target.nil?
    target
  end
end

class Item
  attr_accessor :id, :name, :object, :big, :qty, :parts
  def initialize(id, name, qty, object, big = false)
    @id = id
    @name = name
    @object = object
    @big = big
    @qty = qty.is_a?(String) ? qty.to_i : qty
    @parts = {}
  end
  def add_part(id, name, quantity, item = nil)
    # cquantity can be a range.
    @parts[id] = [name , quantity.is_a?(String) ? quantity.to_i: quantity]#, item]
  end
  def to_s
    "#{@id} (#{@name})=#{@parts}"
  end
end

recipes = Recipes.new
recipes.process_shops
prices_file = "/Users/mvdb/projects/gaming/stardew/999challenge/src/data/prices.json"
File.write(prices_file, JSON.pretty_generate(recipes.shops,{:array_nl => '', :indent => ''}))
items = recipes.process_parts
# all needs to add parts to items, for eg dehydrator, wine, etc
all = recipes.process_all(items)
items_file = "/Users/mvdb/projects/gaming/stardew/999challenge/src/data/items.json"
File.write(items_file, JSON.pretty_generate(all,{:indent => '', object_nl: ""}))
resources = recipes.process_items(items)
parts_file = "/Users/mvdb/projects/gaming/stardew/999challenge/src/data/parts.json"
File.write(parts_file, JSON.pretty_generate(items.map{|k,v| [k, v.parts, v.qty]},{:array_nl => '', :indent => ''}))
trove_file = "/Users/mvdb/projects/gaming/stardew/999challenge/src/data/trove.json"
trove_items = recipes.lookup_id("Artifact Trove")[1]["GeodeDrops"].first["RandomItemId"].map{|item_id| recipes.lookup_item(item_id)["Name"]}
File.write(trove_file, JSON.pretty_generate(trove_items,{:indent => '', object_nl: ""}))
puts "done"